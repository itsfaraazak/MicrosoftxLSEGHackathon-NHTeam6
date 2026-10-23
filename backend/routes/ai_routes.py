"""OWNER B (AI Layer): /api/profile/parse, /api/ask. Also app-wide LLM deadline + error mapping (504/502)."""
from flask import Blueprint, g, jsonify, request

from ai import llm, rigor
from routes._mock import mock, use_mocks

bp = Blueprint("ai", __name__)


@bp.before_app_request
def _open_deadline():
    g.llm_deadline_token = llm.start_deadline()


@bp.teardown_app_request
def _close_deadline(_exc):
    token = g.pop("llm_deadline_token", None)
    if token is not None:
        try:
            llm.end_deadline(token)
        except ValueError:
            pass


@bp.app_errorhandler(llm.LLMTimeout)
def _llm_timeout(e):
    return jsonify({"error": f"The AI took too long to answer: {e}", "fallback": True}), 504


@bp.app_errorhandler(llm.LLMError)
def _llm_error(e):
    return jsonify({"error": f"The AI service is unavailable: {e}", "fallback": True}), 502


@bp.post("/api/profile/parse")
def profile_parse():
    if use_mocks():
        return mock("profile_parse")
    from ai.functions import parse_profile
    try:
        with rigor.collect():
            result = parse_profile(request.json["text"])
            meta = rigor.meta()
        return jsonify({**result, "meta": meta})
    except ValueError as e:
        return jsonify({"error": str(e)}), 422


@bp.post("/api/ask")
def ask():
    if use_mocks():
        # Even on mocks, questions about the app's own data get the true, code-built answer.
        from ai.data_availability import direct_answer
        body = request.get_json(silent=True) or {}
        direct = direct_answer(str(body.get("question", "")), str(body.get("sim_date", "2022-01-03")))
        if direct:
            return jsonify({"answer": direct, "facts_used": []})
        return mock("ask")
    from ai.functions import answer
    body = request.json
    with rigor.collect():
        result = answer(body["question"], body["profile"], body["sim_date"])
        meta = rigor.meta()
    return jsonify({**result, "meta": meta})
