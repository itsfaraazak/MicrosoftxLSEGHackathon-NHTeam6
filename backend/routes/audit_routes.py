"""OWNER B (AI Layer): GET /api/audit, GET /api/rigor/summary.

Surfaces the audit trail db.store already writes (profile, exposure, explanation, number_check_reject,
ask, ask_refused, coach, guard_event, agent_action) and a static summary of the rigor mechanisms in the
codebase, so judges can see what actually happened without reading source."""
import re
import time
from pathlib import Path

from flask import Blueprint, jsonify, request

from db import store
from routes._mock import mock, use_mocks

bp = Blueprint("audit", __name__)

TESTS_DIR = Path(__file__).parent.parent / "tests"

_GUARDRAIL_TEXT = {
    "future_question": "future-looking question",
    "prompt_injection": "prompt injection attempt",
    "distress": "possible distress signal",
    "other": "a guarded topic",
}


def _summary(ev: dict) -> str:
    """One human sentence per audit kind. Payloads here are never secret (profiles, questions, prices) -
    nothing is redacted."""
    kind = ev.get("kind", "")
    p = ev.get("payload") or {}

    if kind == "ask":
        q = p.get("question", "")
        checked = p.get("numbers_checked", 0)
        rejected = len(p.get("rejected") or [])
        return f"Asked: {q} -> answered, {checked} numbers checked, {rejected} rejected"
    if kind == "ask_refused":
        label = p.get("guardrail", "other")
        q = p.get("question", "")
        return f"Refused before the model: {_GUARDRAIL_TEXT.get(label, label)} ({q})"
    if kind == "number_check_reject":
        bad = p.get("bad") or []
        bad_str = ", ".join(f'"{b}"' for b in bad) if bad else "a number"
        return f"Number check rejected {bad_str} and regenerated"
    if kind == "profile":
        name = p.get("name") or "a client"
        n = len(p.get("contradictions") or [])
        return f"Parsed profile for {name} ({n} contradiction{'s' if n != 1 else ''} flagged)"
    if kind == "exposure":
        n = len(p.get("sectors") or {})
        return f"Mapped exposure across {n} sector(s) via {p.get('source', '?')}"
    if kind == "explanation":
        return "Generated a portfolio explanation, number-checked against facts"
    if kind == "coach":
        return "Generated a coaching message after a drawdown"
    if kind == "guard_event":
        pct = p.get("drawdown_pct")
        scope = "market-wide" if p.get("market_wide") else "portfolio-specific"
        return f"Guard event: {pct}% drawdown ({scope}), suggested {p.get('suggested_action', '?')}"
    if kind == "agent_action":
        return f"Agent action: {p.get('rule_triggered', '?')} on {p.get('ticker', '?')}"
    return f"{kind or 'event'} logged"


@bp.get("/api/audit")
def audit():
    if use_mocks():
        return mock("audit")
    try:
        limit = int(request.args.get("limit", 50))
    except (TypeError, ValueError):
        limit = 50
    limit = max(1, min(limit, 500))
    kind = request.args.get("kind")
    kinds = [k.strip() for k in kind.split(",") if k.strip()] if kind else None

    events = store.recent(limit=limit, kinds=kinds)
    return jsonify({"events": [
        {"id": e.get("id"), "kind": e.get("kind"), "ts": e.get("ts"),
         "summary": _summary(e), "payload": e.get("payload") or {}}
        for e in events
    ]})


_test_cache: dict = {"ts": 0.0, "data": None}
_DEF_RE = re.compile(r"^\s*def (test_\w+)", re.MULTILINE)
_CASE_RE = re.compile(r'"\s*,\s*[A-Z]\)')  # red-team ("...", F) / ("...", I) / ("...", D) tuple rows


def _test_counts() -> dict:
    now = time.monotonic()
    if _test_cache["data"] is not None and now - _test_cache["ts"] < 300:
        return _test_cache["data"]
    backend = 0
    redteam = 0
    try:
        for f in TESTS_DIR.glob("test_*.py"):
            text = f.read_text()
            backend += len(_DEF_RE.findall(text))
            if f.name == "test_redteam.py":
                redteam = len(_CASE_RE.findall(text))
    except OSError:
        pass
    data = {"backend": backend, "redteam_cases": redteam}
    _test_cache.update(ts=now, data=data)
    return data


PRINCIPLES = [
    {"id": "code_decides", "title": "Code decides, AI explains",
     "detail": "Holdings, trades and sector weights are computed deterministically in code. The LLM only "
               "narrates facts it is handed; it never chooses a ticker or an allocation."},
    {"id": "data_clock", "title": "A hard data clock",
     "detail": "Every prompt is pinned to the simulation date. The model is told never to use or imply "
               "knowledge after that date, and the number check independently rejects any year or date "
               "later than the sim date (look-ahead leaks)."},
    {"id": "number_check", "title": "Every number is checked against facts",
     "detail": "Every digit or spelled-out quantity the model writes must match a Fact object produced by "
               "code. A mismatch is rejected and the model is asked to regenerate (up to 2 retries); if it "
               "still fails, a deterministic template built only from code-side numbers is used instead."},
    {"id": "guardrails", "title": "Deterministic guardrails before the model",
     "detail": "Future-looking questions, prompt-injection attempts (including obfuscation via base64, "
               "homoglyphs, zero-width characters and leetspeak) and signs of financial distress are caught "
               "by code-side pattern checks before the question ever reaches the LLM."},
    {"id": "audit", "title": "Everything is logged",
     "detail": "Every parse, exposure mapping, explanation, answer, refusal, number-check rejection and "
               "coaching message is written to the audit log with its inputs and outputs, visible at "
               "GET /api/audit."},
    {"id": "honest_verdicts", "title": "Honest verdicts, not cherry-picked ones",
     "detail": "GET /api/proof backtests claims against real history and reports not_supported verdicts "
               "honestly rather than hiding or softening them."},
]

GUARDED_BY = [
    "Deterministic guardrail regex for future-questions / prompt-injection / distress (ai/guardrails.py)",
    "Number check of every LLM number against code-side Facts, with retry + template fallback (ai/number_check.py)",
    "Per-call and per-request LLM timeouts/deadlines (ai/llm.py)",
    "Full audit log of every AI/tool event (db/store.py, GET /api/audit)",
]


@bp.get("/api/rigor/summary")
def rigor_summary():
    return jsonify({
        "principles": PRINCIPLES,
        "tests": _test_counts(),
        "guarded_by": GUARDED_BY,
    })
