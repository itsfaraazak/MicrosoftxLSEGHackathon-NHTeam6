"""Live data endpoints: GET /api/live/status, GET /api/live/quotes, POST /api/live/refresh,
GET /api/data/sources. yfinance is monkeypatched everywhere here — no network calls in tests.

The most important test is leak safety: appending new, real, wall-clock rows to prices.csv via
/api/live/refresh must NEVER change anything already computed with a fixed sim_date (as_of).
"""
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from app import app
from engine import data_clock
from routes import live_routes

TICKERS = [
    "BIL", "SHY", "BND", "TIP", "VTI", "VXUS", "VT",
    "XLK", "XLC", "XLV", "XLP", "XLU", "XLE", "XLF", "XLI", "XLRE", "QQQ",
]


def _make_prices(start="2020-01-01", end="2021-12-31"):
    idx = pd.bdate_range(start, end)
    rng = np.random.default_rng(7)
    df = pd.DataFrame(
        {t: 100 * np.cumprod(1 + rng.normal(0.0003, 0.01, len(idx))) for t in TICKERS}, index=idx,
    )
    df.index.name = "Date"
    return df


@pytest.fixture
def live_env(monkeypatch, tmp_path):
    """Point every module at an isolated tmp prices.csv / data dir; reset caches and cooldown."""
    df = _make_prices()
    csv = tmp_path / "prices.csv"
    df.to_csv(csv)

    monkeypatch.setattr(data_clock, "_PRICES", None)
    monkeypatch.setattr(data_clock, "PRICES_CSV", csv)
    monkeypatch.setattr(live_routes, "PRICES_CSV", csv)
    monkeypatch.setattr(live_routes, "DATA_DIR", tmp_path)
    monkeypatch.setattr(live_routes, "FRED_CSV", tmp_path / "fred.csv")
    monkeypatch.setenv("USE_MOCKS", "0")
    live_routes._quotes_cache["payload"] = None
    live_routes._quotes_cache["fetched_at"] = 0.0
    monkeypatch.setattr(live_routes, "_last_refresh_at", 0.0)
    return csv, df


def _fake_close(df: pd.DataFrame):
    """Mimic yf.download(tickers, ...)["Close"] by wrapping df under a 'Close' column level."""
    def fake_download(tickers, **_kwargs):
        return pd.concat({"Close": df[tickers]}, axis=1)
    return fake_download


def test_status_reports_real_coverage(live_env):
    _csv, df = live_env
    r = app.test_client().get("/api/live/status")
    assert r.status_code == 200
    body = r.get_json()
    assert body["rows"] == len(df)
    assert body["tickers"] == len(TICKERS)
    assert body["latest_date"] == str(df.index.max().date())
    assert body["first_date"] == str(df.index.min().date())
    assert body["source"] == "yfinance"
    assert body["live_enabled"] is True


def test_quotes_monkeypatched_no_network(live_env, monkeypatch):
    idx = pd.bdate_range("2026-10-20", "2026-10-22")
    close = pd.DataFrame({t: [100.0, 101.0, 102.0] for t in TICKERS}, index=idx)
    monkeypatch.setattr(live_routes.yf, "download", _fake_close(close))

    r = app.test_client().get("/api/live/quotes")
    assert r.status_code == 200
    body = r.get_json()
    assert body["as_of"] == "2026-10-22"
    assert len(body["quotes"]) == len(TICKERS)
    qqq = next(q for q in body["quotes"] if q["ticker"] == "QQQ")
    assert qqq["close"] == pytest.approx(102.0)
    assert qqq["prev_close"] == pytest.approx(101.0)
    assert qqq["change_pct"] == pytest.approx((102.0 / 101.0 - 1) * 100, abs=1e-2)


def test_quotes_cached_for_5_minutes(live_env, monkeypatch):
    idx = pd.bdate_range("2026-10-20", "2026-10-22")
    close = pd.DataFrame({t: [100.0, 101.0, 102.0] for t in TICKERS}, index=idx)
    calls = {"n": 0}

    def fake_download(tickers, **_kwargs):
        calls["n"] += 1
        return pd.concat({"Close": close[tickers]}, axis=1)

    monkeypatch.setattr(live_routes.yf, "download", fake_download)
    c = app.test_client()
    first = c.get("/api/live/quotes").get_json()
    second = c.get("/api/live/quotes").get_json()
    assert calls["n"] == 1  # second call served from cache, no re-download
    assert first == second


def test_quotes_last_good_fallback_on_upstream_failure(live_env, monkeypatch):
    idx = pd.bdate_range("2026-10-20", "2026-10-22")
    close = pd.DataFrame({t: [100.0, 101.0, 102.0] for t in TICKERS}, index=idx)
    monkeypatch.setattr(live_routes.yf, "download", _fake_close(close))
    c = app.test_client()
    good = c.get("/api/live/quotes").get_json()

    live_routes._quotes_cache["fetched_at"] = 0.0  # force the cache to look stale

    def fail(*_a, **_kw):
        raise RuntimeError("yfinance unreachable")

    monkeypatch.setattr(live_routes.yf, "download", fail)
    r = c.get("/api/live/quotes")
    assert r.status_code == 200
    assert r.get_json() == good


def test_quotes_502_with_no_cache_and_upstream_down(live_env, monkeypatch):
    def fail(*_a, **_kw):
        raise RuntimeError("yfinance unreachable")

    monkeypatch.setattr(live_routes.yf, "download", fail)
    r = app.test_client().get("/api/live/quotes")
    assert r.status_code == 502
    assert r.get_json()["fallback"] is True


def test_refresh_appends_atomically(live_env, monkeypatch):
    csv, original = live_env
    new_idx = pd.bdate_range("2022-01-03", "2022-01-05")
    new_close = pd.DataFrame({t: [200.0, 201.0, 202.0] for t in TICKERS}, index=new_idx)
    monkeypatch.setattr(live_routes.yf, "download", _fake_close(new_close))

    r = app.test_client().post("/api/live/refresh")
    assert r.status_code == 200
    body = r.get_json()
    assert body["ok"] is True
    assert body["rows_added"] == 3
    assert body["previous_latest"] == str(original.index.max().date())
    assert body["as_of"] == "2022-01-05"

    on_disk = pd.read_csv(csv, index_col=0, parse_dates=True)
    assert len(on_disk) == len(original) + 3
    assert str(on_disk.index.max().date()) == "2022-01-05"


def test_refresh_cooldown_blocks_second_call(live_env, monkeypatch):
    new_idx = pd.bdate_range("2022-01-03", "2022-01-03")
    new_close = pd.DataFrame({t: [200.0] for t in TICKERS}, index=new_idx)
    monkeypatch.setattr(live_routes.yf, "download", _fake_close(new_close))
    c = app.test_client()
    assert c.post("/api/live/refresh").status_code == 200
    r2 = c.post("/api/live/refresh")
    assert r2.status_code == 429
    assert r2.get_json()["fallback"] is True


def test_refresh_never_corrupts_file_on_download_failure(live_env, monkeypatch):
    csv, _original = live_env
    before = Path(csv).read_text()

    def fail(*_a, **_kw):
        raise RuntimeError("yfinance down")

    monkeypatch.setattr(live_routes.yf, "download", fail)
    r = app.test_client().post("/api/live/refresh")
    assert r.status_code == 502
    assert r.get_json()["fallback"] is True
    assert Path(csv).read_text() == before  # untouched


def test_data_sources_lists_real_files_on_disk(live_env, monkeypatch, tmp_path):
    (tmp_path / "fred.csv").write_text("date,CPIAUCSL,TB3MS\n2020-01-01,100,1\n2020-02-01,101,1.1\n")
    (tmp_path / "layoffs.csv").write_text("company,date\nFoo,2022-01-01\nBar,2022-06-01\n")

    r = app.test_client().get("/api/data/sources")
    assert r.status_code == 200
    body = r.get_json()
    ids = {s["id"] for s in body}
    assert {"prices", "fred", "layoffs", "mocks"} <= ids
    prices_src = next(s for s in body if s["id"] == "prices")
    assert prices_src["kind"] == "real"
    mocks_src = next(s for s in body if s["id"] == "mocks")
    assert mocks_src["kind"] == "mock"


def test_leak_safety_refresh_does_not_change_historical_reads(live_env, monkeypatch):
    """The core guarantee: extending prices.csv with new real-world rows must not change what
    engine/data_clock.get_prices() returns for any fixed sim_date in the past. This is what
    protects every already-computed /api/proof and /api/replay number from changing underfoot."""
    as_of = "2021-06-01"
    before = data_clock.get_prices(TICKERS, as_of)

    new_idx = pd.bdate_range("2022-01-03", "2022-01-10")
    new_close = pd.DataFrame({t: 9999.0 for t in TICKERS}, index=new_idx)  # deliberately wild values
    monkeypatch.setattr(live_routes.yf, "download", _fake_close(new_close))

    r = app.test_client().post("/api/live/refresh")
    assert r.status_code == 200
    assert r.get_json()["rows_added"] == len(new_idx)

    after = data_clock.get_prices(TICKERS, as_of)
    pd.testing.assert_frame_equal(before, after)
    # and the leak assertion inside get_prices itself still holds
    assert after.index.max() <= pd.Timestamp(as_of)
