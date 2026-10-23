"""OWNER C (Time Machine): /api/replay, /api/agent/step."""
from flask import Blueprint

from routes._mock import mock, use_mocks

bp = Blueprint("timemachine", __name__)


@bp.get("/api/replay")
def replay():
    if use_mocks():
        return mock("replay")
    raise NotImplementedError("C: engine.guard.replay -> B: ai.functions.coach")


@bp.post("/api/agent/step")
def agent_step():
    if use_mocks():
        return mock("agent_step")
    raise NotImplementedError("C (bonus): engine.agent")
