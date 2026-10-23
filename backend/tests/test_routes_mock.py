import pytest

from app import app

GET = ["/api/health", "/api/replay?profile_id=priya&from=2022-01-03&to=2023-12-29"]
POST = ["/api/profile/parse", "/api/portfolio", "/api/compare", "/api/ask", "/api/agent/step"]


@pytest.mark.parametrize("path", GET)
def test_get(path):
    assert app.test_client().get(path).status_code == 200


@pytest.mark.parametrize("path", POST)
def test_post(path):
    assert app.test_client().post(path, json={}).status_code == 200


def test_mocks_match_models():
    import json
    from pathlib import Path

    from models import Portfolio, Profile
    m = Path(__file__).parent.parent / "mocks"
    Profile(**json.loads((m / "profile_parse.json").read_text())["profile"])
    Portfolio(**json.loads((m / "portfolio.json").read_text())["portfolio"])
    compare = json.loads((m / "compare.json").read_text())["portfolios"]
    for pf in [json.loads((m / "portfolio.json").read_text())["portfolio"], *compare]:
        model = Portfolio(**pf)
        assert model.baseline_overlap_score is not None and model.baseline_overlap_score > model.overlap_score
        assert all(p.reason for p in model.positions)


def test_portfolio_falls_back_to_mock_when_engine_missing(monkeypatch):
    from routes import portfolio_routes
    monkeypatch.setenv("USE_MOCKS", "0")
    monkeypatch.setattr(portfolio_routes, "_engine", lambda: None)
    r = app.test_client().post("/api/portfolio", json={})
    assert r.status_code == 200 and r.headers["X-Source"] == "mock"


def test_rate_limit(monkeypatch):
    import app as app_module
    monkeypatch.setenv("RATE_LIMIT_PER_MIN", "2")
    app_module._hits.clear()
    codes = [app.test_client().post("/api/ask", json={}, headers={"X-Forwarded-For": "9.9.9.9"}).status_code
             for _ in range(3)]
    assert codes == [200, 200, 429]


def test_portfolio_registers_profile_for_replay(monkeypatch):
    from engine import personas
    from routes import portfolio_routes
    monkeypatch.setenv("USE_MOCKS", "0")
    personas.REGISTRY.clear()

    class FakeEngine:
        @staticmethod
        def build(profile, exposure, sim_date):
            raise RuntimeError("stop after registration")
    monkeypatch.setattr(portfolio_routes, "_engine", lambda: FakeEngine)
    monkeypatch.setattr(portfolio_routes, "_CACHE", {})
    body = {"profile": {"name": "Quinn Q", "age": 30, "job_title": "x", "industry": "y", "risk_tolerance": "low"},
            "sim_date": "2022-01-03"}
    try:
        app.test_client().post("/api/portfolio", json=body)
    except RuntimeError:
        pass
    assert personas.get_persona("quinn").name == "Quinn Q"
    personas.REGISTRY.clear()
