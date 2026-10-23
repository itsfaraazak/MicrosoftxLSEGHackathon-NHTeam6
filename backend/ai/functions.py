"""Owner B: parse_profile, map_exposure, explain, answer, coach.
The LLM interprets text and explains facts. Code decides. Every LLM output is number-checked."""
import json
import re

from pydantic import ValidationError

from ai import guardrails, llm
from ai.exposure_fallback import fallback_exposure
from ai.number_check import check
from db import store
from models import ExposureMap, Fact, GuardEvent, Portfolio, Profile

SIM_START = "2022-01-03"
RETRIES = 2


def _json(text: str) -> dict:
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    return json.loads(text)


def _contradictions(p: Profile) -> list[str]:
    """Code-side check so the flag never depends on the model noticing."""
    out = list(p.contradictions)
    sold = re.search(r"\b(sold|panic|dumped|cashed out)\b", p.past_behaviour, re.IGNORECASE)
    if p.risk_tolerance == "high" and sold and not any("sold" in c.lower() or "behaviour" in c.lower() for c in out):
        out.append(f"Stated high risk tolerance but past behaviour: {p.past_behaviour}")
    return out


def parse_profile(text: str) -> dict:
    schema = ("name, age (int), job_title, industry, employer, location, risk_tolerance (low|medium|high), "
              "experience (none|some|experienced), emergency_fund_months (number), high_interest_debt (bool), "
              "past_behaviour (string), exclusions (list), contradictions (list of strings), "
              "goals (list of {name, amount_usd, years_away}), holdings (list of {ticker, amount_usd, is_employer_stock}). "
              "Use null-safe defaults: unknown numbers 0, unknown text ''. Flag contradictions between stated "
              "risk tolerance and past behaviour.")
    prompt = f"Extract a Profile JSON with fields: {schema}\n\n{guardrails.fence(text)}"
    error = ""
    for _ in range(RETRIES + 1):
        try:
            data = _json(llm.chat(SIM_START, prompt + error, json_mode=True))
            profile = Profile(**data)
            profile.contradictions = _contradictions(profile)
            store.log("profile", profile.model_dump(mode="json"))
            return {"profile": profile.model_dump(mode="json"), "contradictions": profile.contradictions}
        except (json.JSONDecodeError, ValidationError, TypeError) as e:
            error = f"\n\nYour previous output was invalid ({str(e)[:200]}). Return valid JSON only."
    raise ValueError("Could not parse a valid profile from the text")


def map_exposure(profile: Profile) -> ExposureMap:
    """LLM maps job/employer to sectors; weights validated in code; keyword fallback if it fails."""
    prompt = (f"Which market sectors does this person's income and employer already depend on? Sectors allowed: "
              f"{guardrails.SECTORS}. Return JSON {{\"sectors\": {{name: weight 0..1}}}}. "
              f"Job: {guardrails.fence(profile.job_title)} Industry: {guardrails.fence(profile.industry)} "
              f"Employer: {guardrails.fence(profile.employer)}")
    sectors: dict[str, float] = {}
    source = "llm"
    try:
        raw = _json(llm.chat(SIM_START, prompt, json_mode=True)).get("sectors", {})
        sectors = {s: min(max(float(w), 0.0), 1.0) for s, w in raw.items() if s in guardrails.SECTORS}
    except Exception:
        sectors = {}
    if not sectors:
        sectors, source = fallback_exposure(profile.job_title, profile.industry, profile.employer), "keyword-fallback"
    result = ExposureMap(sectors=sectors, source=source)
    store.log("exposure", result.model_dump())
    return result


def _facts_prompt(facts: list[Fact]) -> str:
    return "\n".join(f"- {f.id}: {f.value:g}{f.unit} (source {f.source}, as of {f.as_of})" for f in facts)


def _template_explanation(portfolio: Portfolio, facts: list[Fact]) -> str:
    """Deterministic fallback: only numbers straight from code, so it always passes the check."""
    lines = [f"As of {portfolio.sim_date}, ${portfolio.safe_bucket_usd:,.0f} is in the safe bucket and "
             f"${portfolio.growth_bucket_usd:,.0f} in the growth bucket."]
    for p in portfolio.positions:
        why = "; ".join(f"{f.id} {f.value:g}{f.unit}" for f in p.reason_facts) or "diversification"
        lines.append(f"{p.ticker}: ${p.amount_usd:,.0f} ({why}).")
    return " ".join(lines)


def _checked(prompt: str, facts: list[Fact], sim_date: str, fallback: str, extra_allow: set[float] | None = None) -> str:
    year = int(sim_date[:4])
    for _ in range(RETRIES + 1):
        text = llm.chat(sim_date, prompt)
        bad = check(text, facts, sim_year=year, allow=extra_allow)
        if not bad:
            return text
        prompt += f"\n\nYour previous answer used numbers not in the facts ({bad}). Rewrite using only the facts."
        store.log("number_check_reject", {"bad": bad, "sim_date": sim_date})
    return fallback


def explain(portfolio: Portfolio, facts: list[Fact]) -> str:
    sim_date = str(portfolio.sim_date)
    allow = {p.amount_usd for p in portfolio.positions} | {portfolio.safe_bucket_usd, portfolio.growth_bucket_usd}
    prompt = ("Explain this portfolio to a non-expert in 4-6 sentences. Say why the client holds less of the "
              "sectors their job already depends on. Cite the facts.\n"
              f"Positions: {[(p.ticker, p.amount_usd, p.bucket) for p in portfolio.positions]}\n"
              f"Facts:\n{_facts_prompt(facts)}")
    text = _checked(prompt, facts, sim_date, _template_explanation(portfolio, facts), allow)
    store.log("explanation", {"sim_date": sim_date, "text": text})
    return text


def _default_facts(sim_date: str) -> list[Fact]:
    """Until A's engine is live, use the mock fact slice (clearly labelled by source)."""
    from pathlib import Path
    mock = json.loads((Path(__file__).parent.parent / "mocks" / "portfolio.json").read_text())
    return [Fact(**f) for f in mock["facts"]]


def answer(question: str, profile: dict | Profile, sim_date: str, facts: list[Fact] | None = None) -> dict:
    refusal = guardrails.pre_filter(question, sim_date)
    if refusal:
        store.log("ask_refused", {"question": question, "sim_date": sim_date})
        return {"answer": refusal, "facts_used": []}
    profile = profile if isinstance(profile, Profile) else Profile(**profile)
    if facts is None:
        try:
            from engine.portfolio import build
            facts = build(profile, map_exposure(profile), sim_date)[1]
        except (ImportError, NotImplementedError):
            facts = _default_facts(sim_date)
    prompt = (f"Answer the client's question using only these facts. If they don't cover it, say you don't know.\n"
              f"Client: {profile.job_title} in {profile.industry}.\nFacts:\n{_facts_prompt(facts)}\n"
              f"Question: {guardrails.fence(question)}")
    text = _checked(prompt, facts, sim_date, "I don't have enough information in today's data to answer that.")
    store.log("ask", {"question": question, "answer": text, "sim_date": sim_date})
    return {"answer": text, "facts_used": [f.model_dump(mode="json") for f in facts]}


def coach(event: GuardEvent, facts: list[Fact]) -> str:
    sim_date = str(event.sim_date)
    allow = {abs(event.drawdown_pct), event.cost_of_selling_usd, event.goal_years_away}
    scope = "market-wide, not specific to the client's holdings" if event.market_wide else "specific to the client's holdings"
    fallback = (f"Your portfolio is down {abs(event.drawdown_pct):g}%. This is {scope}. "
                f"Selling now would lock in a loss of ${event.cost_of_selling_usd:,.0f}. "
                f"Suggested action: {event.suggested_action.replace('_', ' ')}. The decision is yours.")
    prompt = ("Write a calm 3-4 sentence coaching message for a client considering selling after a drop. "
              "Cover: what happened, whether it is market-wide, what selling would lock in, how it relates to their goal. "
              f"Never tell them what the market will do. Final decision is theirs.\n"
              f"Drawdown: {abs(event.drawdown_pct):g}%. Market-wide: {event.market_wide}. "
              f"Cost of selling: ${event.cost_of_selling_usd:,.0f}. Goal years away: {event.goal_years_away:g}. "
              f"Suggested action (from code): {event.suggested_action}.\nFacts:\n{_facts_prompt(facts)}")
    text = _checked(prompt, facts, sim_date, fallback, allow)
    store.log("coach", {"sim_date": sim_date, "text": text})
    return text

