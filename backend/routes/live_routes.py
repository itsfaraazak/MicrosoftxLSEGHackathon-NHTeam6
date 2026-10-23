"""Live data (data agent). GET /api/live/status, GET /api/live/quotes, POST /api/live/refresh,
GET /api/data/sources.

Everything else in the app computes with `as_of = sim_date` via engine/data_clock.get_prices(),
which still refuses to leak anything after as_of. These endpoints only report on / extend what is
actually on disk (real wall-clock trading days) — they never change how historical endpoints
compute, which is covered by backend/tests/test_live.py.
"""
import os
import tempfile
import time
from pathlib import Path

import pandas as pd
import yfinance as yf
from flask import Blueprint, jsonify

from engine import data_clock
from routes._mock import MOCKS, mock, use_mocks

bp = Blueprint("live", __name__)

DATA_DIR = Path(__file__).parent.parent / "data"
PRICES_CSV = DATA_DIR / "prices.csv"
FRED_CSV = DATA_DIR / "fred.csv"

TICKER_NAMES = {
    "BIL": "SPDR Bloomberg 1-3 Month T-Bill",
    "SHY": "iShares 1-3 Year Treasury Bond",
    "BND": "Vanguard Total Bond Market",
    "TIP": "iShares TIPS Bond",
    "VTI": "Vanguard Total Stock Market",
    "VXUS": "Vanguard Total International Stock",
    "VT": "Vanguard Total World Stock",
    "XLK": "Technology Select Sector SPDR",
    "XLC": "Communication Services Select Sector SPDR",
    "XLV": "Health Care Select Sector SPDR",
    "XLP": "Consumer Staples Select Sector SPDR",
    "XLU": "Utilities Select Sector SPDR",
    "XLE": "Energy Select Sector SPDR",
    "XLF": "Financial Select Sector SPDR",
    "XLI": "Industrial Select Sector SPDR",
    "XLRE": "Real Estate Select Sector SPDR",
    "QQQ": "Invesco QQQ",
}

_QUOTES_TTL_S = 300
_REFRESH_COOLDOWN_S = 60

# Module-level mutable cache / throttle state (per gunicorn worker process).
_quotes_cache: dict = {"payload": None, "fetched_at": 0.0}
_last_refresh_at: float = 0.0


def _tickers() -> list[str]:
    return list(pd.read_csv(PRICES_CSV, index_col=0, nrows=0).columns)


def _rates() -> dict:
    """Most recent CPI YoY% and TB3MS from fred.csv (no network call; it's already on disk)."""
    if not FRED_CSV.exists():
        return {"tb3ms": None, "cpi_yoy": None}
    try:
        df = pd.read_csv(FRED_CSV, parse_dates=["date"]).sort_values("date")
        tb3ms = df["TB3MS"].dropna()
        cpi = df["CPIAUCSL"].dropna()
        tb3ms_val = float(tb3ms.iloc[-1]) if len(tb3ms) else None
        cpi_yoy = None
        if len(cpi) >= 13:
            latest, year_ago = cpi.iloc[-1], cpi.iloc[-13]
            cpi_yoy = round((latest / year_ago - 1) * 100, 2)
        return {"tb3ms": tb3ms_val, "cpi_yoy": cpi_yoy}
    except Exception:  # noqa: BLE001 - fred.csv missing/malformed: quotes should still render
        return {"tb3ms": None, "cpi_yoy": None}


@bp.get("/api/live/status")
def status():
    if use_mocks():
        return mock("live_status")
    cov = data_clock.coverage()
    latest = cov["latest_date"]
    stale_days = 0
    if latest:
        stale_days = max((pd.Timestamp.now().normalize() - pd.Timestamp(latest)).days, 0)
    return jsonify({
        "latest_date": latest,
        "first_date": cov["first_date"],
        "rows": cov["rows"],
        "tickers": cov["tickers"],
        "source": "yfinance",
        "stale_days": stale_days,
        "live_enabled": True,
    })


@bp.get("/api/live/quotes")
def quotes():
    if use_mocks():
        return mock("live_quotes")

    now = time.time()
    cached = _quotes_cache["payload"]
    if cached is not None and now - _quotes_cache["fetched_at"] < _QUOTES_TTL_S:
        return jsonify(cached)

    tickers = _tickers()
    try:
        raw = yf.download(tickers, period="5d", progress=False, auto_adjust=False)["Close"]
        raw = raw[tickers].dropna(how="all").ffill()
        last_two = raw.tail(2)
        if len(last_two) < 1:
            raise ValueError("no quote data returned")
        close_row = last_two.iloc[-1]
        prev_row = last_two.iloc[-2] if len(last_two) >= 2 else close_row
        as_of = str(last_two.index[-1].date())
        quote_list = []
        for t in tickers:
            close = float(close_row[t])
            prev = float(prev_row[t])
            change_pct = round((close / prev - 1) * 100, 2) if prev else 0.0
            quote_list.append({
                "ticker": t,
                "name": TICKER_NAMES.get(t, t),
                "close": round(close, 2),
                "prev_close": round(prev, 2),
                "change_pct": change_pct,
            })
        payload = {
            "as_of": as_of,
            "fetched_at": pd.Timestamp.now("UTC").strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source": "yfinance",
            "quotes": quote_list,
            "rates": _rates(),
        }
        _quotes_cache["payload"] = payload
        _quotes_cache["fetched_at"] = now
        return jsonify(payload)
    except Exception as e:  # noqa: BLE001 - any yfinance/network failure: fall back to last-good cache
        if cached is not None:
            return jsonify(cached)  # last-good fallback
        return jsonify({"error": f"quote fetch failed: {e}", "fallback": True}), 502


@bp.post("/api/live/refresh")
def refresh():
    if use_mocks():
        return jsonify({"ok": True, "as_of": "2026-10-22", "rows_added": 0, "previous_latest": "2024-12-31"})

    global _last_refresh_at
    now = time.time()
    if now - _last_refresh_at < _REFRESH_COOLDOWN_S:
        return jsonify({"error": "refresh on cooldown, try again shortly", "fallback": True}), 429

    tickers = _tickers()
    previous_latest = data_clock.latest_date()
    start = (pd.Timestamp(previous_latest) + pd.Timedelta(days=1)).strftime("%Y-%m-%d")
    today = pd.Timestamp.now().strftime("%Y-%m-%d")
    if start > today:
        return jsonify({"ok": True, "as_of": previous_latest, "rows_added": 0, "previous_latest": previous_latest})

    try:
        new = yf.download(tickers, start=start, end=today, progress=False, auto_adjust=False)["Close"]
    except Exception as e:  # noqa: BLE001 - any yfinance/network failure must not touch prices.csv
        return jsonify({"error": f"download failed: {e}", "fallback": True}), 502

    _last_refresh_at = now  # only start the cooldown once we actually attempted a download

    if new is None or len(new) == 0:
        return jsonify({"ok": True, "as_of": previous_latest, "rows_added": 0, "previous_latest": previous_latest})

    try:
        new = new.reindex(columns=tickers)
        new.index.name = "Date"
        existing = pd.read_csv(PRICES_CSV, index_col=0, parse_dates=True)
        combined = pd.concat([existing, new[~new.index.isin(existing.index)]]).sort_index()
        combined = combined[~combined.index.duplicated(keep="last")]

        fd, tmp_path = tempfile.mkstemp(dir=DATA_DIR, suffix=".csv.tmp")
        os.close(fd)
        try:
            combined.to_csv(tmp_path)
            os.replace(tmp_path, PRICES_CSV)  # atomic on same filesystem
        except Exception:
            Path(tmp_path).unlink(missing_ok=True)
            raise

        data_clock.reload()
        rows_added = int(len(combined) - len(existing))
        new_latest = data_clock.latest_date()
        return jsonify({
            "ok": True,
            "as_of": new_latest,
            "rows_added": rows_added,
            "previous_latest": previous_latest,
        })
    except Exception as e:  # noqa: BLE001 - any merge/write failure: report it, never leave a half-written file
        # prices.csv was never touched if we failed before os.replace; data_clock cache untouched either way.
        return jsonify({"error": f"append failed, prices.csv unchanged: {e}", "fallback": True}), 502


def _file_rows_and_range(path: Path, date_col: str | None = None) -> tuple[int, str | None, str | None]:
    try:
        if date_col:
            df = pd.read_csv(path, usecols=[date_col], parse_dates=[date_col])
            dates = df[date_col].dropna()
        else:
            df = pd.read_csv(path, index_col=0, parse_dates=True)
            dates = df.index
        if len(dates) == 0:
            return len(df), None, None
        return len(df), str(pd.Timestamp(min(dates)).date()), str(pd.Timestamp(max(dates)).date())
    except Exception:  # noqa: BLE001 - malformed/missing file: report zero rows rather than 500
        return 0, None, None


@bp.get("/api/data/sources")
def data_sources():
    if use_mocks():
        return mock("data_sources")

    sources = []

    if PRICES_CSV.exists():
        rows, lo, hi = _file_rows_and_range(PRICES_CSV)
        sources.append({
            "id": "prices", "label": "ETF daily closing prices",
            "provider": "yfinance (Yahoo Finance)", "file": "prices.csv",
            "rows": rows, "from": lo, "to": hi,
            "fetched_at": pd.Timestamp.fromtimestamp(PRICES_CSV.stat().st_mtime).isoformat(),
            "kind": "real",
        })

    if FRED_CSV.exists():
        rows, lo, hi = _file_rows_and_range(FRED_CSV, date_col="date")
        sources.append({
            "id": "fred", "label": "CPI (CPIAUCSL) and 3-month T-bill rate (TB3MS)",
            "provider": "FRED (Federal Reserve Bank of St. Louis)", "file": "fred.csv",
            "rows": rows, "from": lo, "to": hi,
            "fetched_at": pd.Timestamp.fromtimestamp(FRED_CSV.stat().st_mtime).isoformat(),
            "kind": "real",
        })

    layoffs_csv = DATA_DIR / "layoffs.csv"
    if layoffs_csv.exists():
        rows, lo, hi = _file_rows_and_range(layoffs_csv, date_col="date")
        sources.append({
            "id": "layoffs", "label": "Tech layoffs tracker",
            "provider": "layoffs.fyi (via public GitHub mirror)", "file": "layoffs.csv",
            "rows": rows, "from": lo, "to": hi,
            "fetched_at": pd.Timestamp.fromtimestamp(layoffs_csv.stat().st_mtime).isoformat(),
            "kind": "real",
        })

    if MOCKS.exists():
        mock_files = sorted(p.name for p in MOCKS.glob("*.json"))
        sources.append({
            "id": "mocks", "label": "Frontend mock fixtures",
            "provider": "internal", "file": "mocks/*.json",
            "rows": len(mock_files), "from": None, "to": None,
            "fetched_at": pd.Timestamp.fromtimestamp(MOCKS.stat().st_mtime).isoformat(),
            "kind": "mock",
        })

    return jsonify(sources)
