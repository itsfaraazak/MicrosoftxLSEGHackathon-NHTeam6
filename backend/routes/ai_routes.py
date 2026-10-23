"""OWNER B (AI Layer): /api/profile/parse, /api/ask."""
from flask import Blueprint, jsonify, request

from routes._mock import mock, use_mocks

bp = Blueprint("ai", __name__)


@bp.post("/api/profile/parse")
def profile_parse():
    if use_mocks():
        return mock("profile_parse")
    from ai.functions import parse_profile
    try:
        return jsonify(parse_profile(request.json["text"]))
    except ValueError as e:
        return jsonify({"error": str(e)}), 422


@bp.post("/api/ask")
def ask():
    if use_mocks():
        return mock("ask")
    from ai.functions import answer
    body = request.json
    return jsonify(answer(body["question"], body["profile"], body["sim_date"]))
