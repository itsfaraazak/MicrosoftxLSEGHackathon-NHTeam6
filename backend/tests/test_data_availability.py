"""The Ask panel must tell the truth about the data it has, and must not repeat facts."""
from datetime import date

import pandas as pd
import pytest

from ai import data_availability as da
from ai import functions, guardrails, llm
from models import Fact

LIVE = "2026-10-22"


@pytest.fixture(autouse=True)
def isolate_store(monkeypatch, tmp_path):
    from db import store
    monkeypatch.setattr(store, "LOCAL", tmp_path / "s.jsonl")
    monkeypatch.setattr(store, "_container", None)
    monkeypatch.delenv("COSMOS_ENDPOINT", raising=False)


def fact(i, v, u="%", as_of="2022-01-03"):
    return Fact(id=i, value=v, unit=u, source="yfinance", as_of=as_of)


@pytest.mark.parametrize("q", ["Do you have recent data?", "Is your data up to date?", "How recent is your data?",
                               "What data do you have?", "Do you have access to today's prices?",
                               "What's the latest data you have", "How old is your data", "What is today's date?"])
def test_data_questions_detected_and_not_refused(q):
    assert da.is_data_question(q)
    assert guardrails.pre_filter(q, LIVE) is None and guardrails.pre_filter(q, "2022-01-03") is None


@pytest.mark.parametrize("q", ["Why so little in my job's sector?", "Should I sell?", "What if markets fall 30%?",
                               "What is diversification?"])
def test_ordinary_questions_are_not_data_questions(q):
    assert not da.is_data_question(q)


def test_live_mode_says_yes_with_the_date_and_never_denies_access():
    out = da.direct_answer("Do you have recent data?", LIVE, latest=LIVE, today=date(2026, 10, 23))
    assert out.startswith("Yes.") and "22 Oct 2026" in out
    assert "news" in out and "don't have access" not in out.lower()
    assert "days old" not in out  # one day old is not stale


def test_live_mode_flags_stale_data_honestly():
    out = da.direct_answer("Is your data up to date?", "2024-12-31", latest="2024-12-31", today=date(2026, 10, 23))
    assert "31 Dec 2024" in out and "days old" in out and "Go live" in out


def test_2022_mode_explains_the_cutoff_without_revealing_the_file_end():
    out = da.direct_answer("How recent is your data?", "2022-01-03", latest=LIVE)
    assert "3 Jan 2022" in out and "on purpose" in out and "Go live" in out
    assert "2026" not in out  # the look-ahead rule: no hint of how far the file extends


def test_non_data_question_gets_no_direct_answer():
    assert da.direct_answer("Why so little tech?", LIVE, latest=LIVE) is None


def test_answer_skips_the_llm_for_data_questions(monkeypatch):
    calls = []
    monkeypatch.setattr(llm, "chat", lambda *a, **k: calls.append(1) or "x")
    monkeypatch.setattr(da, "latest_on_disk", lambda: LIVE)
    out = functions.answer("Do you have recent data?", None, LIVE, facts=[fact("goal_years", 5, "y")])
    assert out["answer"].startswith("Yes.") and out["facts_used"] == [] and calls == []


def test_dedupe_collapses_identical_facts_but_keeps_different_values():
    facts = [fact("job_overlap", 0.0)] * 9 + [fact("job_overlap", 12.0), fact("tech_overlap", 31.0)]
    out = da.dedupe_facts(facts)
    assert [(f.id, f.value) for f in out] == [("job_overlap", 0.0), ("job_overlap", 12.0), ("tech_overlap", 31.0)]


def test_answer_prompt_and_facts_used_have_no_repeats(monkeypatch):
    prompts = []
    monkeypatch.setattr(llm, "chat", lambda sd, user, **k: prompts.append(user) or "Your job overlap is 0%.")
    facts = [fact("job_overlap", 0.0) for _ in range(9)] + [fact("goal_years", 5, "y")]
    out = functions.answer("Why so little in my job's sector?", None, "2022-01-03", facts=facts)
    assert prompts[0].count("- job_overlap:") == 1
    assert "at most once" in prompts[0]
    assert [f["id"] for f in out["facts_used"]] == ["job_overlap", "goal_years"]


def test_prompt_tells_the_model_what_data_exists(monkeypatch):
    prompts = []
    monkeypatch.setattr(llm, "chat", lambda sd, user, **k: prompts.append(user) or "ok")
    monkeypatch.setattr(da, "latest_on_disk", lambda: LIVE)
    functions.answer("Why so little in my job's sector?", None, LIVE, facts=[fact("goal_years", 5, "y", LIVE)])
    assert "closing prices for 17 ETFs up to 2026-10-22" in prompts[0] and "Never say you lack access" in prompts[0]


def test_market_facts_only_for_recent_market_questions_and_never_after_sim_date():
    idx = pd.date_range("2026-10-01", periods=10, freq="B")
    df = pd.DataFrame({"QQQ": range(100, 110), "VTI": range(50, 60)}, index=idx, dtype=float)
    assert da.market_facts("Why so little tech?", LIVE, prices=df) == []
    facts = da.market_facts("What happened to QQQ this week?", LIVE, prices=df)
    ids = {f.id: f.value for f in facts}
    assert ids["last_close_qqq"] == 109.0 and ids["week_change_qqq"] == round((109 / 104 - 1) * 100, 1)
    assert all(str(f.as_of) == "2026-10-14" for f in facts) and "last_close_vti" not in ids


def test_market_facts_through_the_real_data_clock_respect_sim_date():
    from engine import data_clock
    try:
        data_clock.latest_date()
    except (FileNotFoundError, OSError):
        pytest.skip("prices.csv not downloaded")
    facts = da.market_facts("How is QQQ doing today?", "2022-01-03")
    assert facts and all(str(f.as_of) <= "2022-01-03" for f in facts)
