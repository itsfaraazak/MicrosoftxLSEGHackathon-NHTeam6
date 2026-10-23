import time

import pytest

from ai import llm
from app import app


@pytest.fixture
def live(monkeypatch):
    monkeypatch.setenv("USE_MOCKS", "0")
    monkeypatch.setenv("LLM_BASE_URL", "http://localhost:1/v1/")
    monkeypatch.setenv("LLM_API_KEY", "x")
    monkeypatch.setenv("LLM_MODEL", "m")
    monkeypatch.setenv("LLM_TIMEOUT_S", "0.2")
    monkeypatch.setenv("LLM_DEADLINE_S", "0.5")
    return app.test_client()


def _post_parse(c):
    return c.post("/api/profile/parse", json={"text": "I am a nurse"})


def test_slow_model_returns_504_fast(live, monkeypatch):
    monkeypatch.setattr(llm, "_complete", lambda *a, **k: time.sleep(3) or "{}")
    t = time.monotonic()
    r = _post_parse(live)
    assert time.monotonic() - t < 1
    assert r.status_code == 504
    assert r.get_json()["fallback"] is True and r.get_json()["error"]


def test_failing_model_returns_502(live, monkeypatch):
    def boom(*a, **k):
        raise ConnectionError("down")
    monkeypatch.setattr(llm, "_complete", boom)
    r = live.post("/api/ask", json={"question": "why bonds?", "profile": _profile(), "sim_date": "2022-01-03"})
    assert r.status_code == 502
    assert r.get_json()["fallback"] is True


def test_retries_share_one_deadline(monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "u")
    monkeypatch.setenv("LLM_API_KEY", "x")
    monkeypatch.setenv("LLM_MODEL", "m")
    monkeypatch.setenv("LLM_TIMEOUT_S", "0.3")
    monkeypatch.setattr(llm, "_complete", lambda *a, **k: time.sleep(2) or "x")
    t = time.monotonic()
    with llm.request_deadline(0.5), pytest.raises(llm.LLMTimeout):
        for _ in range(10):
            llm.chat("2022-01-03", "hi")
    assert time.monotonic() - t < 1.2


def test_azure_fallback_config(monkeypatch):
    for k in ("LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://x.example/")
    monkeypatch.setenv("AZURE_OPENAI_API_KEY", "k")
    monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT", "d")
    assert llm.configured()
    assert llm._settings() == ("https://x.example/openai/v1/", "k", "d")


def _profile():
    import json
    from pathlib import Path
    return json.loads((Path(__file__).parent.parent / "mocks" / "profile_parse.json").read_text())["profile"]
