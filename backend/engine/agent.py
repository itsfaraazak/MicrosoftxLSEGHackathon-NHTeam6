"""Autopilot (module 7): a rule-bound rebalancing agent.

All rules live in CODE, never in a prompt. The function takes NO free text:
only a typed Portfolio, a date and numeric limits. Prices come from the data
clock with as_of=sim_date, so no future data is visible.
"""

from db import store
from engine import data_clock
from models import AgentAction, Portfolio

WHITELIST = ["BIL", "SHY", "BND", "TIP", "VTI", "VXUS", "VT",
             "XLK", "XLC", "XLV", "XLP", "XLU", "XLE", "XLF", "XLI", "XLRE"]  # QQQ is comparison-only
DRIFT_PP = 0.05
MAX_TRADE_USD = 2000.0
APPROVAL_USD = 1000.0


def _last(tickers: list[str], as_of: str) -> dict[str, float]:
    if not tickers:
        return {}
    df = data_clock.get_prices(tickers, as_of).ffill()
    if df.empty:
        return {}
    row = df.iloc[-1].dropna()
    return {t: float(v) for t, v in row.items()}


def _result(trades, rule, kill, slice_usd, log_id):
    return {"trades": trades, "rule_triggered": rule, "kill_switch": kill,
            "slice_usd": round(slice_usd, 2), "log_id": log_id}


def step(portfolio: Portfolio, sim_date: str, *, slice_pct: float = 0.15,
         max_trade_usd: float = MAX_TRADE_USD, kill_threshold_pct: float = -0.10,
         approval_threshold_usd: float = APPROVAL_USD, targets: dict[str, float] | None = None) -> dict:
    slice_pct = min(max(float(slice_pct), 0.0), 0.20)  # hard ceiling: never manage more than 20%
    start = str(portfolio.sim_date)
    audit: dict = {"sim_date": sim_date, "start": start, "slice_pct": slice_pct, "refused": []}

    def done(trades, rule, kill, slice_usd):
        audit.update(rule_triggered=rule, kill_switch=kill, slice_usd=slice_usd,
                     trades=[t["ticker"] + ":" + str(t["trade_usd"]) for t in trades])
        doc = store.log("agent_action", audit)
        return _result(trades, rule, kill, slice_usd, doc["id"])

    if sim_date < start:
        audit["refused"].append("sim_date before portfolio start")
        return done([], "none", False, 0.0)

    total = sum(p.amount_usd for p in portfolio.positions)
    held = {}
    for p in portfolio.positions:
        if p.ticker in WHITELIST:
            held[p.ticker] = held.get(p.ticker, 0.0) + p.amount_usd
        else:
            audit["refused"].append(f"{p.ticker}: not on whitelist")
    p0 = _last(list(held), start)
    p1 = _last(list(held), sim_date)
    held = {t: a for t, a in held.items() if t in p0 and t in p1}
    if not held or total <= 0:
        return done([], "none", False, 0.0)

    base = sum(held.values())
    slice_start = total * slice_pct
    # the managed slice holds the same mix as the portfolio, scaled to slice_pct of its value
    units = {t: (a / base) * slice_start / p0[t] for t, a in held.items()}
    value = {t: units[t] * p1[t] for t in held}
    slice_now = sum(value.values())
    ret = slice_now / slice_start - 1

    if ret < kill_threshold_pct:
        audit["refused"].append(f"kill switch: slice {ret:.1%} below {kill_threshold_pct:.0%}")
        return done([], "kill_switch", True, slice_now)

    tg = {t: w for t, w in (targets or {t: a / base for t, a in held.items()}).items() if t in held}
    if len(tg) < len(held) and targets:
        audit["refused"].append("targets outside whitelist/holdings ignored")
    tsum = sum(tg.values()) or 1.0
    tg = {t: w / tsum for t, w in tg.items()}
    drift = {t: value[t] / slice_now - tg.get(t, 0.0) for t in held}
    if max(abs(d) for d in drift.values()) <= DRIFT_PP:
        return done([], "none", False, slice_now)

    trades = []
    for t, d in sorted(drift.items(), key=lambda kv: -abs(kv[1])):
        if abs(d) <= DRIFT_PP:
            continue
        usd = max(-max_trade_usd, min(max_trade_usd, -d * slice_now))
        usd = round(usd, 2)
        if usd == 0:
            continue
        side = "Sell" if usd < 0 else "Buy"
        needs = abs(usd) > approval_threshold_usd
        trades.append({
            **AgentAction(sim_date=sim_date, ticker=t, trade_usd=usd, rule_triggered="rebalance_drift",
                          approved=not needs).model_dump(mode="json"),
            "reason": f"{side} ${abs(usd):,.0f} of {t}: it is {value[t] / slice_now:.0%} of the managed slice "
                      f"vs a {tg.get(t, 0):.0%} target"
                      + (" (needs your approval)" if needs else ""),
        })
    return done(trades, "rebalance_drift" if trades else "none", False, slice_now)
