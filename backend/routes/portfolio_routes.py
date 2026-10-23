"""OWNER A (Portfolio Engine): /api/portfolio, /api/compare."""
from flask import Blueprint

from routes._mock import mock, use_mocks

bp = Blueprint("portfolio", __name__)


@bp.post("/api/portfolio")
def portfolio():
    if use_mocks():
        return mock("portfolio")
    raise NotImplementedError("A: engine.portfolio.build -> B: ai.functions.explain")


@bp.post("/api/compare")
def compare():
    if use_mocks():
        return mock("compare")
    raise NotImplementedError("A")
