import pytest

from app import app
from db import store


@pytest.fixture(autouse=True)
def isolate_store(monkeypatch, tmp_path):
    monkeypatch.setattr(store, "LOCAL", tmp_path / "s.jsonl")
    monkeypatch.setattr(store, "_container", None)
    monkeypatch.delenv("COSMOS_ENDPOINT", raising=False)


def test_recent_empty_when_missing(tmp_path):
    assert store.recent() == []


def test_recent_never_raises_on_corrupt_line(tmp_path):
    store.LOCAL.parent.mkdir(exist_ok=True)
    store.LOCAL.write_text("not json\n{\"id\": \"1\", \"kind\": \"ask\", \"ts\": 1}\n")
    out = store.recent()
    assert len(out) == 1 and out[0]["id"] == "1"


def test_recent_newest_first_and_limit():
    store.log("ask", {"question": "a"})
    store.log("ask", {"question": "b"})
    store.log("ask", {"question": "c"})
    out = store.recent(limit=2)
    assert len(out) == 2
    assert out[0]["payload"]["question"] == "c"
    assert out[1]["payload"]["question"] == "b"


def test_recent_filters_by_kind():
    store.log("ask", {"question": "a"})
    store.log("ask_refused", {"question": "b"})
    out = store.recent(kinds=["ask_refused"])
    assert len(out) == 1 and out[0]["kind"] == "ask_refused"


def test_recent_accepts_single_kind_string():
    store.log("ask", {"question": "a"})
    store.log("coach", {"text": "b"})
    out = store.recent(kinds="coach")
    assert len(out) == 1 and out[0]["kind"] == "coach"


def test_audit_route_shape(monkeypatch):
    monkeypatch.setenv("USE_MOCKS", "0")
    store.log("ask", {"question": "Why do I have so little in tech?", "answer": "...",
                       "sim_date": "2022-01-03", "numbers_checked": 2, "rejected": []})
    store.log("ask_refused", {"question": "Will tech crash?", "sim_date": "2022-01-03",
                               "guardrail": "future_question"})
    store.log("number_check_reject", {"bad": ["41"], "sim_date": "2022-01-03"})

    r = app.test_client().get("/api/audit?limit=5")
    assert r.status_code == 200
    body = r.get_json()
    assert "events" in body and len(body["events"]) == 3
    kinds = [e["kind"] for e in body["events"]]
    assert kinds == ["number_check_reject", "ask_refused", "ask"]
    for e in body["events"]:
        assert set(e) == {"id", "kind", "ts", "summary", "payload"}
        assert isinstance(e["summary"], str) and e["summary"]

    reject_summary = body["events"][0]["summary"]
    assert '"41"' in reject_summary and "regenerated" in reject_summary
    refused_summary = body["events"][1]["summary"]
    assert "future-looking question" in refused_summary
    ask_summary = body["events"][2]["summary"]
    assert "2 numbers checked, 0 rejected" in ask_summary


def test_audit_route_kind_filter(monkeypatch):
    monkeypatch.setenv("USE_MOCKS", "0")
    store.log("ask", {"question": "a"})
    store.log("coach", {"text": "b"})
    r = app.test_client().get("/api/audit?kind=coach")
    body = r.get_json()
    assert len(body["events"]) == 1 and body["events"][0]["kind"] == "coach"


def test_audit_route_defaults_to_mock():
    r = app.test_client().get("/api/audit")
    assert r.status_code == 200
    body = r.get_json()
    assert "events" in body and len(body["events"]) > 0


def test_audit_route_never_500_on_bad_params(monkeypatch):
    monkeypatch.setenv("USE_MOCKS", "0")
    r = app.test_client().get("/api/audit?limit=not-a-number")
    assert r.status_code == 200


def test_rigor_summary_route():
    r = app.test_client().get("/api/rigor/summary")
    assert r.status_code == 200
    body = r.get_json()
    assert len(body["principles"]) == 6
    for p in body["principles"]:
        assert set(p) == {"id", "title", "detail"}
    assert body["tests"]["backend"] > 0
    assert body["tests"]["redteam_cases"] > 0
    assert isinstance(body["guarded_by"], list) and body["guarded_by"]
