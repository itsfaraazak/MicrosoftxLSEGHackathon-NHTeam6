"""Rigor metadata collector: a per-request contextvar that lets deeply-nested code (ai/functions.py,
ai/number_check.py) record what actually happened - guardrail hits, LLM calls, number-check outcomes,
timed steps - WITHOUT changing any existing function signature or return value. Routes read it back out
as the optional `meta` field on LLM-backed responses.

API:
    with rigor.collect():
        result = functions.answer(question, profile, sim_date)
        meta = rigor.meta()   # dict, read before the `with` block exits
    jsonify({**result, "meta": meta})

Inside instrumented code, call any of:
    rigor.set_model(name)                         # e.g. from ai.llm.model_name()
    rigor.set_data_as_of(date_str)                 # the sim_date facts are pinned to
    rigor.set_guardrail(label)                     # None | "future_question" | "prompt_injection" | "distress"
    rigor.note_llm_call()                          # += 1 llm_calls
    rigor.note_number_check(checked, rejected)      # += numbers_checked, extends rejected[]
    rigor.note_retry()                              # += number_check.retries
    rigor.note_fallback_used()                      # number_check.fallback_used = True
    rigor.step(name, kind, ms, result)              # kind: "code" | "llm"; appends to steps[]

Every setter/notehere is a no-op when no `collect()` block is open (e.g. plain unit tests that call
ai.functions functions directly), so nothing outside routes/ai_routes.py needs to change.
"""
import contextlib
import contextvars
import time

_current: contextvars.ContextVar[dict | None] = contextvars.ContextVar("rigor", default=None)

DEFAULT_MODEL = "gpt-6.1-sol"


def _new() -> dict:
    return {
        "model": None,
        "llm_calls": 0,
        "guardrail": None,
        "number_check": {"numbers_checked": 0, "rejected": [], "retries": 0, "fallback_used": False},
        "data_as_of": None,
        "steps": [],
        "_start": time.monotonic(),
    }


@contextlib.contextmanager
def collect():
    """Open a fresh collector for the duration of the block. Call rigor.meta() inside the block."""
    token = _current.set(_new())
    try:
        yield
    finally:
        _current.reset(token)


def _get() -> dict | None:
    return _current.get()


def set_model(name: str | None) -> None:
    d = _get()
    if d is not None and name:
        d["model"] = name


def set_data_as_of(date_str) -> None:
    d = _get()
    if d is not None and date_str:
        d["data_as_of"] = str(date_str)


def set_guardrail(label: str | None) -> None:
    d = _get()
    if d is not None:
        d["guardrail"] = label


def note_llm_call() -> None:
    d = _get()
    if d is not None:
        d["llm_calls"] += 1


def note_number_check(checked: int, rejected: list) -> None:
    d = _get()
    if d is None:
        return
    nc = d["number_check"]
    nc["numbers_checked"] += checked
    nc["rejected"].extend(rejected)


def note_retry() -> None:
    d = _get()
    if d is not None:
        d["number_check"]["retries"] += 1


def note_fallback_used() -> None:
    d = _get()
    if d is not None:
        d["number_check"]["fallback_used"] = True


def step(name: str, kind: str, ms: int, result: str) -> None:
    d = _get()
    if d is not None:
        d["steps"].append({"name": name, "kind": kind, "ms": ms, "result": result})


def meta() -> dict | None:
    """Snapshot of the current collector, or None if no collect() block is open."""
    d = _get()
    if d is None:
        return None
    return {
        "model": d["model"] or DEFAULT_MODEL,
        "latency_ms": int((time.monotonic() - d["_start"]) * 1000),
        "llm_calls": d["llm_calls"],
        "guardrail": d["guardrail"],
        "number_check": d["number_check"],
        "data_as_of": d["data_as_of"],
        "steps": d["steps"],
    }
