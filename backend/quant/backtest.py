"""Backtest + named stress windows. Prices come ONLY from engine.data_clock (no look-ahead).

Method: constant weights, rebalanced daily. Funds with later inception (e.g. VXUS, XLC) are handled by
starting the test at the first day ALL held funds have prices (common start); no renormalising.
"""
import pandas as pd

from engine import data_clock
from quant.metrics import portfolio_value, window_return

STRESS_WINDOWS = [
    ("2015-16 sell-off", "2015-07-20", "2016-02-11"),
    ("Q4 2018 sell-off", "2018-10-01", "2018-12-24"),
    ("COVID crash", "2020-02-19", "2020-03-23"),
]


def last_day_before(sim_date: str) -> str:
    return (pd.Timestamp(sim_date) - pd.Timedelta(days=1)).strftime("%Y-%m-%d")


def backtest(weights: dict[str, float], baseline_weights: dict[str, float], sim_date: str, start: str = "2015-01-01"):
    """Return (strategy_values, baseline_values) on the common dates, using data before sim_date only."""
    tickers = sorted(set(weights) | set(baseline_weights))
    prices = data_clock.get_prices(tickers, as_of=last_day_before(sim_date)).loc[start:]
    prices = prices.dropna()  # common start across every fund in either portfolio
    if len(prices) < 30:
        raise ValueError("not enough price history before sim_date")
    return portfolio_value(prices, weights), portfolio_value(prices, baseline_weights)


def stress_windows(values: pd.Series):
    """Named windows that fit inside the data (clipped to its end; skipped if they start before it)."""
    out = []
    for name, a, b in STRESS_WINDOWS:
        if pd.Timestamp(a) < values.index[0] or pd.Timestamp(a) >= values.index[-1]:
            continue
        out.append((name, a, min(b, values.index[-1].strftime("%Y-%m-%d"))))
    return out


def stress_returns(strategy, baseline):
    rows = []
    for name, a, b in stress_windows(strategy):
        rows.append({"name": name, "from": a, "to": b, "strategy": round(window_return(strategy, a, b), 3),
                     "baseline": round(window_return(baseline, a, b), 3)})
    return rows
