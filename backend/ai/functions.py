"""Person 3: parse_profile, explain, answer, coach. Plain functions, testable alone."""
import json

from ai.llm import chat
from ai.number_check import Fact, check

SIM_START = "2022-01-03"


def parse_profile(text: str) -> dict:
    out = chat(SIM_START,
               "Extract a Profile JSON (name, age, job_title, industry, employer, location, "
               "risk_tolerance low|medium|high, experience none|some|experienced, "
               "emergency_fund_months, high_interest_debt, past_behaviour, goals[], holdings[], "
               "exclusions[], contradictions[]) from this text. Flag contradictions between "
               f"stated risk and past behaviour.\n\n{text}", json_mode=True)
    profile = json.loads(out)
    return {"profile": profile, "contradictions": profile.get("contradictions", [])}


def explain(portfolio: dict, facts: list[Fact], retries: int = 2) -> str:
    for _ in range(retries + 1):
        text = chat(portfolio["sim_date"],
                    f"Explain this portfolio in plain English.\nPortfolio: {portfolio}\n"
                    f"Facts: {[f.model_dump() for f in facts]}")
        if not check(text, facts):
            return text
    return "Explanation withheld: numbers could not be verified against the facts."


def answer(question: str, profile: dict, sim_date: str) -> dict:
    raise NotImplementedError("Person 3: build facts slice via engine, then chat() + number check")


def coach(event: dict, facts: list[Fact]) -> str:
    raise NotImplementedError("Person 3")
