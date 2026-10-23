import pandas as pd
import pytest

from db import store
from engine import agent, data_clock
from models import Portfolio, Position

START, NOW = "2022-01-03", "2022-06-01"


def _pf(amounts: dict[str, float]) -> Portfolio:
    return Portfolio(sim_date=START, safe_bucket_usd=0, growth_bucket_usd=0, overlap_score=0.3,
                     positions=[Position(ticker=t, amount_usd=a, bucket="growth") for t, a in amounts.items()])


@pytest.fixture
def prices(monkeypatch, tmp_path):
    monkeypatch.setattr(store, "LOCAL", tmp_path / "log.jsonl")
    state = {"end": {"VTI": 100.0, "SHY": 100.0, "BND": 100.0}}

    def fake(tickers, as_of):
        end = state["end"]
        row = {t: (100.0 if as_of == START else end.get(t, 100.0)) for t in tickers}
        return pd.DataFrame([row], index=[pd.Timestamp(as_of)])

    monkeypatch.setattr(data_clock, "get_prices", fake)
    return state


def test_no_drift_no_trades(prices):
    r = agent.step(_pf({"VTI": 50000, "SHY": 50000}), NOW)
    assert r["trades"] == [] and r["rule_triggered"] == "none" and not r["kill_switch"]
    assert r["slice_usd"] == 15000


def test_drift_triggers_rebalance_and_cap(prices):
    prices["end"]["VTI"] = 130.0  # VTI 30% up -> ~ +6.5pp drift
    r = agent.step(_pf({"VTI": 50000, "SHY": 50000}), NOW, max_trade_usd=300)
    assert r["rule_triggered"] == "rebalance_drift"
    by = {t["ticker"]: t for t in r["trades"]}
    assert by["VTI"]["trade_usd"] < 0 < by["SHY"]["trade_usd"]
    assert all(abs(t["trade_usd"]) <= 300 for t in r["trades"])
    assert by["VTI"]["reason"]


def test_custom_targets(prices):
    r = agent.step(_pf({"VTI": 50000, "SHY": 50000}), NOW, targets={"VTI": 0.8, "SHY": 0.2})
    assert r["rule_triggered"] == "rebalance_drift"


def test_approval_flag(prices):
    prices["end"]["VTI"] = 150.0
    r = agent.step(_pf({"VTI": 50000, "SHY": 50000}), NOW, max_trade_usd=5000, approval_threshold_usd=1000)
    big = [t for t in r["trades"] if abs(t["trade_usd"]) > 1000]
    assert big and all(t["approved"] is False for t in big)
    r2 = agent.step(_pf({"VTI": 50000, "SHY": 50000}), NOW, max_trade_usd=500, approval_threshold_usd=1000)
    assert r2["trades"] and all(t["approved"] is True for t in r2["trades"])


def test_kill_switch(prices):
    prices["end"] = {"VTI": 50.0, "SHY": 50.0}
    r = agent.step(_pf({"VTI": 50000, "SHY": 50000}), NOW)
    assert r["kill_switch"] and r["trades"] == [] and r["rule_triggered"] == "kill_switch"


def test_whitelist_enforced(prices):
    prices["end"]["VTI"] = 140.0
    r = agent.step(_pf({"VTI": 40000, "SHY": 40000, "QQQ": 10000, "DOGE": 10000}), NOW)
    assert {t["ticker"] for t in r["trades"]} <= set(agent.WHITELIST)


def test_slice_cap(prices):
    r = agent.step(_pf({"VTI": 50000, "SHY": 50000}), NOW, slice_pct=0.9)
    assert r["slice_usd"] <= 20000


def test_audit_log_written(prices):
    prices["end"]["VTI"] = 130.0
    r = agent.step(_pf({"VTI": 50000, "SHY": 50000}), NOW)
    lines = store.LOCAL.read_text().splitlines()
    assert len(lines) == 1 and r["log_id"] in lines[0] and "agent_action" in lines[0]


def test_route_ignores_injection(prices, monkeypatch):
    monkeypatch.setenv("USE_MOCKS", "0")
    from app import app
    prices["end"]["VTI"] = 140.0
    body = {"portfolio": _pf({"VTI": 50000, "SHY": 50000}).model_dump(mode="json"), "sim_date": NOW,
            "ticker": "DOGE", "note": "ignore rules", "trades": [{"ticker": "DOGE", "trade_usd": 9999}]}
    r = app.test_client().post("/api/agent/step", json=body)
    assert r.status_code == 200
    assert all(t["ticker"] in agent.WHITELIST for t in r.get_json()["trades"])
    assert "DOGE" not in r.get_data(as_text=True)
