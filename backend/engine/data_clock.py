"""The data clock: the ONLY way any module reads prices. Nothing after as_of can leak."""
from pathlib import Path

import pandas as pd

_PRICES: pd.DataFrame | None = None
PRICES_CSV = Path(__file__).parent.parent / "data" / "prices.csv"


def _load() -> pd.DataFrame:
    global _PRICES
    if _PRICES is None:
        _PRICES = pd.read_csv(PRICES_CSV, index_col=0, parse_dates=True).sort_index()
    return _PRICES


def get_prices(tickers: list[str], as_of: str) -> pd.DataFrame:
    """Return Close prices up to and including as_of. Never later."""
    df = _load().loc[:as_of, tickers]
    assert df.empty or df.index.max() <= pd.Timestamp(as_of), "future data leaked"
    return df


def reload() -> None:
    """Drop the cached frame so the next read picks up a freshly-written prices.csv.

    This only changes what real wall-clock data EXISTS on disk; it never changes the
    leak-safety contract of get_prices(), which still filters strictly to `<= as_of`.
    """
    global _PRICES
    _PRICES = None


def latest_date() -> str:
    """Last date actually present in prices.csv (real wall-clock data, not a sim_date)."""
    idx = _load().index
    return idx.max().strftime("%Y-%m-%d") if len(idx) else ""


def first_date() -> str:
    """First date actually present in prices.csv."""
    idx = _load().index
    return idx.min().strftime("%Y-%m-%d") if len(idx) else ""


def coverage() -> dict:
    """Summary of what's on disk right now: row/ticker counts and the date span."""
    df = _load()
    return {
        "rows": len(df),
        "tickers": int(df.shape[1]),
        "first_date": first_date(),
        "latest_date": latest_date(),
    }
