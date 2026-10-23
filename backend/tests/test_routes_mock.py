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
