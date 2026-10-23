"""OWNER A (Portfolio Engine): /api/portfolio, /api/compare.
Uses engine.portfolio.build when it can be imported; otherwise serves the mock (X-Source: mock) so the demo never 500s."""
import logging

from flask import Blueprint, jsonify, request

from routes._mock import mock, use_mocks

bp = Blueprint("portfolio", __name__)
log = logging.getLogger(__name__)


def _engine():
    try:
        from engine import portfolio as engine_portfolio
        return engine_portfolio
    except ImportError as e:  # engine/exposure.py not pushed yet
        log.warning("portfolio engine unavailable, serving mock: %s", e)
        return None


def _mock_response(name: str):
    resp = mock(name)
    resp.headers["X-Source"] = "mock"
    return resp


def _build_one(engine, profile, sim_date: str):
    from ai.functions import map_exposure
    exposure = map_exposure(profile)
    portfolio, facts = engine.build(profile, exposure, sim_date)
    data = portfolio.model_dump(mode="json")
    extra = engine.extra_fields(portfolio, exposure) if hasattr(engine, "extra_fields") else {}
    if "baseline_overlap_score" in extra:
        data["baseline_overlap_score"] = extra["baseline_overlap_score"]
    for pos, ex in zip(data["positions"], extra.get("positions", [])):
        pos["reason"] = ex.get("reason", "")
    return portfolio, data, facts


@bp.post("/api/portfolio")
def portfolio():
    engine = None if use_mocks() else _engine()
    if engine is None:
        return _mock_response("portfolio")
    from ai.functions import explain
    from models import Profile
    body = request.get_json(force=True)
    pf, data, facts = _build_one(engine, Profile(**body["profile"]), body["sim_date"])
    return jsonify({"portfolio": data, "explanation": explain(pf, facts),
                    "facts": [f.model_dump(mode="json") for f in facts]})


@bp.post("/api/compare")
def compare():
    engine = None if use_mocks() else _engine()
    if engine is None:
        return _mock_response("compare")
    from models import Profile
    body = request.get_json(force=True)
    out = [_build_one(engine, Profile(**p), body["sim_date"])[1] for p in body["profiles"]]
    return jsonify({"portfolios": out})
