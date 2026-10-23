"""Guard: watches the portfolio month by month and coaches through drops. Code decides; the LLM only words it.
All prices come through engine.data_clock.get_prices(tickers, as_of)."""
import json
import os
from datetime import date
from pathlib import Path

import pandas as pd

from db import store
from engine import data_clock
from engine.personas import get_persona
from models import Fact, GuardEvent, Portfolio, Position, Profile

BENCH = "QQQ"
MARKET = "VTI"
TOTAL = 100_000.0
TRIGGER_DD = -0.05
BAND = 0.05
MARKET_TOLERANCE = 0.05
RECOVERY_DROP = 0.08
COACH_CACHE = Path(__file__).parent.parent / "data" / "coach_cache.json"
MOCK_PORTFOLIO = Path(__file__).parent.parent / "mocks" / "portfolio.json"


def default_portfolio(profile: Profile | None, start: str) -> Portfolio:
    """Engine portfolio when available, else the mock positions."""
    if profile is not None:
        try:
            from ai.exposure_fallback import fallback_exposure
            from engine.portfolio import build
            from models import ExposureMap
            sectors = fallback_exposure(profile.job_title, profile.industry, profile.employer)
            return build(profile, ExposureMap(sectors=sectors, source="keyword-fallback"), start)[0]
        except Exception:  # noqa: BLE001, S110 - engine missing/broken: demo must still run
            pass
    raw = json.loads(MOCK_PORTFOLIO.read_text())["portfolio"]
    raw["sim_date"] = start
    return Portfolio(**raw)


def _month_labels(start: str, end: str) -> list[str]:
    s, e = pd.Timestamp(start), pd.Timestamp(end)
    labels = [d.strftime("%Y-%m-%d") for d in pd.date_range(s.replace(day=1), e, freq="MS")]
    return labels


def _series(positions: list[Position], start: str, end: str) -> tuple[pd.DataFrame, list[str]]:
    """Monthly values of the buy-and-hold positions bought at the last close on/before start."""
    tickers = sorted({p.ticker for p in positions} | {BENCH, MARKET})
    px = data_clock.get_prices(tickers, end).ffill()
    base = px.loc[:start].iloc[-1]
    labels = _month_labels(start, end)
    rows = {}
    for lab in labels:
        asof = max(pd.Timestamp(lab), pd.Timestamp(start))
        last = px.loc[:asof].iloc[-1]
        rows[lab] = {
            "ours": sum(p.amount_usd * last[p.ticker] / base[p.ticker] for p in positions if pd.notna(base[p.ticker])),
            "growth_value": {p.ticker: p.amount_usd * last[p.ticker] / base[p.ticker]
                             for p in positions if pd.notna(base[p.ticker])},
            "tech_heavy": TOTAL * last[BENCH] / base[BENCH],
            "vti": last[MARKET] / base[MARKET],
        }
    return pd.DataFrame.from_dict(rows, orient="index"), labels


def _recovery_facts(sim_date: str) -> list[Fact]:
    """How long past VTI drops (all <= sim_date) took to get back to their prior peak."""
    px = data_clock.get_prices([MARKET], sim_date)[MARKET].dropna()
    m = px.resample("ME").last()
    peak, in_drop, drop_at, episodes = m.iloc[0], False, None, []
    for dt, v in m.items():
        if v >= peak:
            if in_drop:
                episodes.append((drop_at, dt))
                in_drop = False
            peak = v
        elif not in_drop and v / peak - 1 <= -RECOVERY_DROP:
            in_drop, drop_at = True, dt
    months = [(b.year - a.year) * 12 + b.month - a.month for a, b in episodes]
    d = date.fromisoformat(sim_date)
    facts = [Fact(id="recovery_episodes", value=len(months), unit="drops", source="yfinance", as_of=d)]
    for h in (6, 12, 24):
        share = 100 * sum(x <= h for x in months) / len(months) if months else 0
        facts.append(Fact(id=f"recovery_{h}m_pct", value=round(share), unit="%", source="yfinance", as_of=d))
    return facts


def _goal_years(profile: Profile | None, start: str, sim_date: str) -> float:
    if not profile or not profile.goals:
        return 0.0
    elapsed = (pd.Timestamp(sim_date) - pd.Timestamp(start)).days / 365.25
    return round(max(min(g.years_away for g in profile.goals) - elapsed, 0.0), 1)


def _detect_in(df: pd.DataFrame, labels: list[str], portfolio: Portfolio, sim_date: str,
               profile: Profile | None, start: str) -> list[GuardEvent]:
    vals = df["ours"].astype(float)
    cur = vals.iloc[-1]
    peak = max(TOTAL, vals.max())
    dd = cur / peak - 1
    if dd > TRIGGER_DD:
        return []
    band = int(dd / BAND)
    prior = (vals / vals.cummax().clip(lower=TOTAL) - 1).iloc[:-1]
    if len(prior) and int(prior.min() / BAND) <= band and prior.min() <= TRIGGER_DD:
        return []
    peak_pos = int(vals.values.argmax()) if vals.max() > TOTAL else -1
    vti_peak = df["vti"].iloc[peak_pos] if peak_pos >= 0 else 1.0
    vti_ret = df["vti"].iloc[-1] / vti_peak - 1
    market_wide = bool(vti_ret < 0 and vti_ret - dd <= MARKET_TOLERANCE)
    cost = sum(max(0.0, p.amount_usd - df["growth_value"].iloc[-1].get(p.ticker, p.amount_usd))
               for p in portfolio.positions if p.bucket == "growth")
    goal_years = _goal_years(profile, start, sim_date)
    has_growth = any(p.bucket == "growth" for p in portfolio.positions)
    if profile and profile.goals and goal_years <= 1 and has_growth:
        action = "move_to_safe"
    else:
        action = "hold" if market_wide else "rebalance"
    return [GuardEvent(sim_date=sim_date, drawdown_pct=round(dd * 100, 1), market_wide=market_wide,
                       cost_of_selling_usd=round(cost), goal_years_away=goal_years, suggested_action=action)]


def detect(portfolio: Portfolio, sim_date: str, profile: Profile | None = None) -> list[GuardEvent]:
    """Guard events at sim_date (0 or 1). Fires at -5% from peak, then again only on each further 5pp band."""
    start = str(portfolio.sim_date)
    df, labels = _series(portfolio.positions, start, sim_date)
    return _detect_in(df, labels, portfolio, sim_date, profile, start)


def facts_for(event: GuardEvent) -> list[Fact]:
    d = event.sim_date
    return [
        Fact(id="drawdown_pct", value=abs(event.drawdown_pct), unit="%", source="yfinance", as_of=d),
        Fact(id="cost_of_selling_usd", value=event.cost_of_selling_usd, unit="USD", source="yfinance", as_of=d),
        Fact(id="goal_years_away", value=event.goal_years_away, unit="y", source="profile", as_of=d),
        *_recovery_facts(str(d)),
    ]


def template_message(event: GuardEvent, facts: list[Fact]) -> str:
    scope = "market-wide, not specific to your holdings" if event.market_wide else "specific to your holdings"
    r12 = next((f for f in facts if f.id == "recovery_12m_pct"), None)
    n = next((f for f in facts if f.id == "recovery_episodes"), None)
    hist = (f" In {r12.value:g}% of {n.value:g} similar past drops the market recovered within 12 months."
            if r12 and n and n.value else "")
    return (f"Your portfolio is down {abs(event.drawdown_pct):g}%. This is {scope}. "
            f"Selling now would lock in a loss of ${event.cost_of_selling_usd:,.0f}.{hist} "
            f"Suggested action: {event.suggested_action.replace('_', ' ')}. The decision is yours.")


def _coach_text(profile_id: str, event: GuardEvent, facts: list[Fact], use_llm: bool) -> str:
    if use_llm:
        from ai.functions import coach
        return coach(event, facts)
    try:
        cached = json.loads(COACH_CACHE.read_text()).get(f"{profile_id}|{event.sim_date}")
    except (OSError, ValueError):
        cached = None
    return cached or template_message(event, facts)


def replay(profile: Profile | str, start: str = "2022-01-03", end: str = "2023-12-31",
           portfolio: Portfolio | None = None, use_llm: bool | None = None) -> dict:
    profile_id = profile if isinstance(profile, str) else profile.name.lower()
    prof = get_persona(profile) if isinstance(profile, str) else profile
    if use_llm is None:
        use_llm = os.getenv("REPLAY_LLM") == "1"
    pf = portfolio or default_portfolio(prof, start)
    pf = pf.model_copy(update={"sim_date": date.fromisoformat(start)})
    months, events = [], []
    for lab in _month_labels(start, end):
        df, labels = _series(pf.positions, start, lab)
        row = df.iloc[-1]
        months.append({"date": lab, "ours": round(float(row["ours"])), "tech_heavy": round(float(row["tech_heavy"]))})
        for ev in _detect_in(df, labels, pf, lab, prof, start):
            ev.coach_message = _coach_text(profile_id, ev, facts_for(ev), use_llm)
            store.log("guard_event", {"profile_id": profile_id, **ev.model_dump(mode="json")})
            events.append(ev.model_dump(mode="json"))
    return {"months": months, "events": events}
