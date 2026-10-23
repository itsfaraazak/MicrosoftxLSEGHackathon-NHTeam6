"""Download daily Close (not Adj Close) prices to data/prices.csv. Re-runnable."""
import os
from pathlib import Path

import pandas as pd
import yfinance as yf

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
TICKERS = [
    "BIL", "SHY", "BND", "TIP", "VTI", "VXUS", "VT",
    "XLK", "XLC", "XLV", "XLP", "XLU", "XLE", "XLF", "XLI", "XLRE", "QQQ",
]


def download_prices() -> None:
    df = yf.download(TICKERS, start="2015-01-01", end="2025-01-01", progress=False, auto_adjust=False)["Close"]
    df = df[TICKERS].sort_index().ffill(limit=3)
    df.index.name = "Date"
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    df.to_csv(DATA_DIR / "prices.csv")
    (DATA_DIR / ".prices_ready").write_text("ok\n")
    print(df.shape, df.index.min(), df.index.max())
    print(df.isna().sum().to_dict())


def download_fred() -> None:
    key = os.getenv("FRED_API_KEY")
    if not key:
        print("FRED_API_KEY not set, skipping fred.csv")
        return
    from fredapi import Fred

    fred = Fred(api_key=key)
    pd.DataFrame({
        "CPIAUCSL": fred.get_series("CPIAUCSL", "2015-01-01", "2024-12-31"),
        "TB3MS": fred.get_series("TB3MS", "2015-01-01", "2024-12-31"),
    }).to_csv(DATA_DIR / "fred.csv")


if __name__ == "__main__":
    download_prices()
    download_fred()
