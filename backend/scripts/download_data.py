# scripts/download_data.py
import os
from pathlib import Path

import pandas as pd
import yfinance as yf
from fredapi import Fred

DATA_DIR = Path(__file__).resolve().parent.parent / "backend" / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

TICKERS = [
    "BIL", "SHY", "BND", "TIP",
    "VTI", "VXUS", "VT",
    "XLK", "XLC", "XLV", "XLP", "XLU", "XLE", "XLF", "XLI", "XLRE",
    "QQQ",
]

def download_prices() -> None:
    df = yf.download(
        TICKERS,
        start="2015-01-01",
        end="2024-12-31",
        progress=False,
        auto_adjust=False,
    )["Close"]
    df.to_csv(DATA_DIR / "prices.csv")

def download_fred() -> None:
    key = os.getenv("FRED_API_KEY")
    if not key:
        print("FRED_API_KEY not set, skipping fred.csv")
        return
    fred = Fred(api_key=key)
    cpi = fred.get_series("CPIAUCSL", "2015-01-01", "2024-12-31")
    tbill = fred.get_series("TB3MS", "2015-01-01", "2024-12-31")
    pd.DataFrame({"CPIAUCSL": cpi, "TB3MS": tbill}).to_csv(DATA_DIR / "fred.csv")

if __name__ == "__main__":
    download_prices()
    download_fred()
