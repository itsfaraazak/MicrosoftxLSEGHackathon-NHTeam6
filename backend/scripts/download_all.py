"""Download/refresh every real data file in backend/data/. Re-runnable, no API keys required.

- prices.csv : yfinance daily Close (auto_adjust=False), base 2015-01-01..2024-12-31, then
  extended by whatever is already in the file (use /api/live/refresh or engine.data_clock.reload
  for incremental top-ups; this script re-downloads the full base window).
- fred.csv   : CPIAUCSL + TB3MS from FRED's public fredgraph.csv export (no FRED_API_KEY needed).
- layoffs.csv: layoffs.fyi tracker via a public GitHub mirror (no auth). See data/SOURCES.md.

Usage: cd backend && .venv/bin/python scripts/download_all.py
"""
import sys
import urllib.request
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

FRED_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id={series}"
LAYOFFS_URL = "https://raw.githubusercontent.com/AlexTheAnalyst/MySQL-YouTube-Series/main/layoffs.csv"


def download_prices() -> None:
    from scripts.download_prices import download_prices as _dl
    _dl()


def download_fred() -> None:
    frames = []
    for series in ("CPIAUCSL", "TB3MS"):
        url = FRED_URL.format(series=series)
        with urllib.request.urlopen(url, timeout=30) as resp:
            df = pd.read_csv(resp)
        df = df.rename(columns={"observation_date": "date"})
        df["date"] = pd.to_datetime(df["date"])
        frames.append(df.set_index("date"))
    merged = frames[0].join(frames[1], how="outer").reset_index()
    merged = merged[merged["date"] >= "2015-01-01"].sort_values("date")
    merged.to_csv(DATA_DIR / "fred.csv", index=False)
    print("fred.csv:", merged.shape, merged["date"].min(), merged["date"].max())


def download_layoffs() -> None:
    with urllib.request.urlopen(LAYOFFS_URL, timeout=30) as resp:
        raw = resp.read()
    (DATA_DIR / "layoffs.csv").write_bytes(raw)
    df = pd.read_csv(DATA_DIR / "layoffs.csv")
    print("layoffs.csv:", df.shape)


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    only = sys.argv[1] if len(sys.argv) > 1 else "all"
    if only in ("all", "prices"):
        download_prices()
    if only in ("all", "fred"):
        download_fred()
    if only in ("all", "layoffs"):
        download_layoffs()
