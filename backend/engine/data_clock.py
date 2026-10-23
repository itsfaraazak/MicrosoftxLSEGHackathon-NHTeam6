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
