"""build_proof: backtest a portfolio vs a baseline and decide each claim's verdict BY CODE."""
import hashlib
import inspect
import json
from pathlib import Path

from quant import backtest as bt
from quant import metrics as m

BASELINE = {"name": "Tech-heavy (QQQ)", "weights": {"QQQ": 1.0}}
# Approximate share of each fund in technology (today's, not point-in-time). Fallback only.
TECH_SHARE = {"QQQ": 0.52, "VTI": 0.31, "VT": 0.24, "VXUS": 0.13, "XLK": 1.0, "XLC": 0.0, "XLV": 0.0,
              "XLP": 0.0, "XLU": 0.0, "XLE": 0.0, "XLF": 0.0, "XLI": 0.0, "XLRE": 0.0, "SHY": 0.0, "BND": 0.0,
              "BIL": 0.0, "TIP": 0.0}
CODE = [("portfolio_value", "How the backtest values the portfolio", m.portfolio_value),
        ("cagr", "Yearly return", m.cagr), ("volatility", "Ups and downs (volatility)", m.volatility),
        ("max_drawdown", "Worst fall from a peak", m.max_drawdown),
        ("sharpe", "Return per unit of risk", m.sharpe), ("window_return", "Fall inside a past sell-off", m.window_return),
        ("overlap", "Overlap with your job's sector", m.overlap)]
MIN_GAP = {"cagr": 0.005, "sharpe": 0.05}  # differences smaller than this are "inconclusive"


def weights_from_portfolio(portfolio: dict) -> dict[str, float]:
    pos = portfolio["positions"]
    total = sum(p["amount_usd"] for p in pos)
    if total <= 0:
        raise ValueError("portfolio total must be positive")
    return {p["ticker"]: round(p["amount_usd"] / total, 4) for p in pos}


def _verdict(diff: float, gap: float) -> str:
    """diff > 0 means the claim's direction holds."""
    return "supported" if diff > gap else "not_supported" if diff < -gap else "inconclusive"


def _fact(fid: str, value: float, unit: str, sim_date: str) -> dict:
    return {"id": fid, "value": value, "unit": unit, "source": "backtest", "as_of": sim_date}


def build_proof(profile: dict | None, portfolio: dict, sim_date: str) -> dict:
    weights = weights_from_portfolio(portfolio)
    base_w = BASELINE["weights"]
    strat, base = bt.backtest(weights, base_w, sim_date)
    sr, br = strat.pct_change().dropna(), base.pct_change().dropna()
    ov_s = portfolio.get("overlap_score")
    ov_b = portfolio.get("baseline_overlap_score")
    if ov_s is None or ov_b is None:
        ov_s, ov_b = m.overlap(weights, TECH_SHARE), m.overlap(base_w, TECH_SHARE)
    stress = bt.stress_returns(strat, base)

    vals = {"cagr": (m.cagr(strat), m.cagr(base)), "volatility": (m.volatility(sr), m.volatility(br)),
            "max_drawdown": (m.max_drawdown(strat), m.max_drawdown(base)),
            "sharpe": (m.sharpe(sr), m.sharpe(br)), "tech_overlap": (ov_s, ov_b)}
    meta = [("cagr", "Yearly return", "%", "cagr", True), ("volatility", "Ups and downs (volatility)", "%", "vol", False),
            ("max_drawdown", "Worst fall from a peak", "%", "mdd", True),
            ("sharpe", "Return per unit of risk (Sharpe)", "", "sharpe", True),
            ("tech_overlap", "Overlap with your job's sector", "%", "overlap", False)]
    metrics, facts = [], []
    for mid, label, unit, short, higher_better in meta:
        s, b = vals[mid]
        nd = 3 if unit == "%" else 2
        metrics.append({"id": mid, "label": label, "strategy": round(s, nd), "baseline": round(b, nd), "unit": unit,
                        "better": bool(s > b if higher_better else s < b), "fact_id": f"proof_{short}_strategy"})
        scale = 100 if unit == "%" else 1
        nd_f = 1 if unit == "%" else 2
        # drawdown facts are magnitudes (positive), as in the mock
        for who, v in (("strategy", s), ("baseline", b)):
            facts.append(_fact(f"proof_{short}_{who}", round(abs(v) * scale if mid == "max_drawdown" else v * scale, nd_f),
                               unit, sim_date))
    for s_ in stress:
        key = s_["name"].split()[0].lower().replace("-", "").replace("/", "")
        for who in ("strategy", "baseline"):
            facts.append(_fact(f"proof_stress_{key}_{who}", round(abs(s_[who]) * 100, 1), "%", sim_date))

    falls_less = [s_["strategy"] > s_["baseline"] for s_ in stress]
    mdd_less = vals["max_drawdown"][0] > vals["max_drawdown"][1]
    if stress and mdd_less and all(falls_less):
        c1 = "supported"
    elif stress and not mdd_less and not any(falls_less):
        c1 = "not_supported"
    else:
        c1 = "inconclusive"
    claims = [
        {"id": "c1", "claim": "Falls less than a tech-heavy portfolio in past sell-offs", "verdict": c1,
         "evidence": ["max_drawdown", *[f"stress:{s_['name']}" for s_ in stress]], "code_id": "max_drawdown"},
        {"id": "c2", "claim": "Gives up return in strong tech years",
         "verdict": _verdict(vals["cagr"][1] - vals["cagr"][0], MIN_GAP["cagr"]), "evidence": ["cagr"], "code_id": "cagr"},
        {"id": "c3", "claim": "Better return per unit of risk",
         "verdict": _verdict(vals["sharpe"][0] - vals["sharpe"][1], MIN_GAP["sharpe"]), "evidence": ["sharpe"],
         "code_id": "sharpe"},
    ]

    outputs = {"portfolio_value": f"final value of $1: {strat.iloc[-1]:.3f}", "cagr": f"{vals['cagr'][0]:.3f}",
               "volatility": f"{vals['volatility'][0]:.3f}", "max_drawdown": f"{vals['max_drawdown'][0]:.3f}",
               "sharpe": f"{vals['sharpe'][0]:.2f}",
               "window_return": "; ".join(f"{s_['name']}: {s_['strategy']:.3f}" for s_ in stress) or "no window in range",
               "overlap": f"{ov_s:.2f}"}
    code = []
    for cid, title, fn in CODE:
        src = inspect.getsource(fn).rstrip()
        code.append({"id": cid, "title": title, "source": src, "sha256": hashlib.sha256(src.encode()).hexdigest(),
                     "output": outputs[cid]})

    caveats = [
        "Backtest uses only data before the simulation date (in-sample, past performance).",
        "Weights are rebalanced daily and ignore fees, taxes and trading costs.",
        f"Test starts {strat.index[0].date()}, the first day every fund in either portfolio has prices.",
        "Sector weights are today's, not point-in-time: a known approximation.",
    ]
    proof = {"sim_date": sim_date, "window": {"from": str(strat.index[0].date()), "to": str(strat.index[-1].date())},
             "strategy": {"name": "Job-aware diversified", "weights": weights},
             "baseline": {"name": BASELINE["name"], "weights": base_w}, "metrics": metrics, "stress": stress,
             "claims": claims, "code": code, "facts": facts, "caveats": caveats}
    proof["script"] = build_script(weights, base_w, sim_date, ov_s, ov_b)
    return proof


def build_script(weights: dict, base_w: dict, sim_date: str, ov_s: float, ov_b: float) -> str:
    """Standalone script: embeds the real source of metrics.py and prints every number in the proof."""
    lib = Path(inspect.getsourcefile(m)).read_text()
    last = bt.last_day_before(sim_date)
    return f'''# Reproduce every number in the proof. Needs only pandas and a prices.csv (Date, one column per ticker).
# Usage: python proof_script.py [path/to/prices.csv]
import json
import sys

{lib.split("import pandas as pd", 1)[1].strip()}

import pandas as pd  # noqa: E402

STRATEGY = {json.dumps(weights)}
BASELINE = {json.dumps(base_w)}
LAST_DAY = "{last}"  # day before the simulation date: nothing later is used
WINDOWS = {json.dumps(bt.STRESS_WINDOWS)}
OVERLAP = ({ov_s!r}, {ov_b!r})  # from the portfolio engine's sector data

prices = pd.read_csv(sys.argv[1] if len(sys.argv) > 1 else "prices.csv", index_col=0, parse_dates=True)
prices = prices.sort_index().loc["2015-01-01":LAST_DAY, sorted(set(STRATEGY) | set(BASELINE))].dropna()
out = {{}}
for name, w in (("strategy", STRATEGY), ("baseline", BASELINE)):
    v = portfolio_value(prices, w)
    r = v.pct_change().dropna()
    out[name] = {{"cagr": round(cagr(v), 3), "volatility": round(volatility(r), 3),
                 "max_drawdown": round(max_drawdown(v), 3), "sharpe": round(sharpe(r), 2), "_v": v}}
stress = []
for name, a, b in WINDOWS:
    last = out["strategy"]["_v"].index
    if pd.Timestamp(a) < last[0] or pd.Timestamp(a) >= last[-1]:
        continue
    b = min(b, str(last[-1].date()))
    stress.append({{"name": name, "from": a, "to": b,
                   **{{k: round(window_return(out[k]["_v"], a, b), 3) for k in ("strategy", "baseline")}}}})
for k in out:
    del out[k]["_v"]
out["tech_overlap"] = dict(zip(("strategy", "baseline"), OVERLAP))
out["stress"] = stress
print(json.dumps(out, indent=2))
'''
