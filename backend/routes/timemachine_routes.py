"""OWNER C (Time Machine): /api/replay, /api/agent/step."""
from flask import Blueprint, jsonify, request

from routes._mock import mock, use_mocks

bp = Blueprint("timemachine", __name__)


@bp.get("/api/replay")
def replay():
    if use_mocks():
        return mock("replay")
    from engine import guard
    from models import GuardEvent

    args = request.args
    try:
        result = guard.replay(
            args.get("profile_id", "priya"), args.get("from", "2022-01-03"), args.get("to", "2023-12-31"),
            use_llm=True if args.get("llm") == "1" else None,
        )
    except KeyError as e:
        return jsonify({"error": f"{e}. Build a plan for this person first (POST /api/portfolio)."}), 404
    result["events"] = [GuardEvent(**e).model_dump(mode="json") for e in result["events"]]
    return jsonify(result)


@bp.post("/api/agent/step")
def agent_step():
    if use_mocks():
        return mock("agent_step")
    from flask import jsonify, request
    from pydantic import ValidationError

    from engine import agent
    from models import Portfolio

    body = request.get_json(silent=True) or {}
    try:  # only these two fields are read; any other key (free text) is ignored
        pf = Portfolio(**body["portfolio"])
        sim_date = str(body["sim_date"])[:10]
    except (KeyError, TypeError, ValidationError) as e:
        return jsonify({"error": f"invalid request: {type(e).__name__}"}), 400
    return jsonify(agent.step(pf, sim_date))
