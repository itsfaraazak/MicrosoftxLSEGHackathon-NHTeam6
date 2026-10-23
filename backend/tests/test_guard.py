import numpy as np
import pandas as pd
import pytest

from engine import data_clock, guard
from engine.personas import PERSONAS
from models import Portfolio, Position, Profile

TICKERS = ["SHY", "VTI", "QQQ"]


@pytest.fixture(autouse=True)
def isolate_store(monkeypatch, tmp_path):
    from db import store
    monkeypatch.setattr(store, "LOCAL", tmp_path / "s.jsonl")
    monkeypatch.setattr(store, "_container", None)
    monkeypatch.delenv("COSMOS_ENDPOINT", raising=False)
    monkeypatch.setattr(guard, "COACH_CACHE", tmp_path / "none.json")


def synth(monkeypatch, poison=False):
    idx = pd.bdate_range("2010-01-01", "2023-12-31")
    n = len(idx)
    t = np.arange(n)
    vti = 100 * (1 + 0.0003) ** t * np.where(idx >= "2022-03-01", 0.8, 1.0)
    qqq = 100 * (1 + 0.0004) ** t * np.where(idx >= "2022-03-01", 0.6, 1.0)
    shy = np.full(n, 100.0)
    df = pd.DataFrame({"SHY": shy, "VTI": vti, "QQQ": qqq}, index=idx)
    if poison:
        df.loc[idx[-1], :] = 1e9
    monkeypatch.setattr(data_clock, "_PRICES", df)
    return df


def portfolio():
    return Portfolio(sim_date="2022-01-03", safe_bucket_usd=30000, growth_bucket_usd=70000, overlap_score=0.3,
                     positions=[Position(ticker="SHY", amount_usd=30000, bucket="safe"),
                                Position(ticker="VTI", amount_usd=70000, bucket="growth")])


PROFILE = Profile(name="T", age=30, job_title="x", industry="y", risk_tolerance="medium")


def test_detect_fires_after_drop_and_not_before(monkeypatch):
    synth(monkeypatch)
    assert guard.detect(portfolio(), "2022-02-01", PROFILE) == []
    ev = guard.detect(portfolio(), "2022-03-01", PROFILE)
    assert len(ev) == 1 and ev[0].drawdown_pct < -5 and ev[0].market_wide
    assert ev[0].cost_of_selling_usd > 10000 and ev[0].suggested_action == "hold"


def test_replay_shape_and_not_every_month(monkeypatch):
    synth(monkeypatch)
    r = guard.replay(PROFILE, "2022-01-03", "2022-12-31", portfolio())
    assert r["months"][0] == {"date": "2022-01-01", "ours": 100000, "tech_heavy": 100000}
    assert len(r["months"]) == 12 and len(r["events"]) == 1
    assert r["events"][0]["coach_message"]
    assert r["months"][-1]["tech_heavy"] < r["months"][-1]["ours"]


def test_goal_within_12_months_moves_to_safe(monkeypatch):
    synth(monkeypatch)
    p = Profile(**{**PROFILE.model_dump(), "goals": [{"name": "g", "amount_usd": 1, "years_away": 0.5}]})
    ev = guard.detect(portfolio(), "2022-03-01", p)
    assert ev[0].suggested_action == "move_to_safe"


def test_no_future_data_leak(monkeypatch):
    synth(monkeypatch, poison=True)
    r = guard.replay(PROFILE, "2022-01-03", "2022-12-31", portfolio())
    assert max(m["ours"] for m in r["months"]) < 200000
    assert guard.detect(portfolio(), "2022-03-01", PROFILE)


def test_unknown_persona():
    with pytest.raises(KeyError):
        guard.replay("nobody")


@pytest.mark.skipif(not data_clock.PRICES_CSV.exists(), reason="prices.csv missing")
def test_real_priya_2022_fires():
    data_clock._PRICES = None
    assert set(PERSONAS) == {"priya", "tom", "fiona"}
    r = guard.replay("priya", "2022-01-03", "2023-12-31")
    assert any(e["sim_date"].startswith("2022") for e in r["events"])
    m = {x["date"]: x for x in r["months"]}
    assert m["2022-12-01"]["tech_heavy"] < m["2022-12-01"]["ours"]
    assert 70000 < m["2022-12-01"]["tech_heavy"] < 80000


def test_replay_works_for_a_user_built_profile():
    from engine import personas
    from models import Profile
    p = Profile(name="Zed", age=33, job_title="Teacher", industry="Education", risk_tolerance="medium")
    assert pytest.raises(KeyError, personas.get_persona, "zed")
    personas.remember(p)
    assert personas.get_persona("ZED").name == "Zed"
    personas.REGISTRY.clear()
