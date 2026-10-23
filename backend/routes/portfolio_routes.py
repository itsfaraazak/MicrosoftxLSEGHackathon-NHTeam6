"""OWNER A (Portfolio Engine): /api/portfolio, /api/compare.
Uses engine.portfolio.build when it can be imported; otherwise serves the mock (X-Source: mock) so the demo never 500s."""
import hashlib
import json
import logging

from flask import Blueprint, jsonify, request

from routes._mock import mock, use_mocks

bp = Blueprint("portfolio", __name__)
log = logging.getLogger(__name__)

# In-memory cache: identical (profile, sim_date) -> already-built response. Keeps repeat demo
# clicks (same persona, same date) instant instead of re-paying LLM latency for map_exposure
# + explain. Cleared on process restart; fine for a single-demo-run gunicorn process.
_CACHE: dict[str, dict] = {}


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


def _cache_key(profile_dict: dict, sim_date: str) -> str:
    blob = json.dumps(profile_dict, sort_keys=True, default=str) + "|" + sim_date
    return hashlib.sha256(blob.encode()).hexdigest()


def _build_one(engine, profile, sim_date: str):
    from ai.functions import map_exposure
    from engine.exposure import normalize_exposure
    exposure = normalize_exposure(map_exposure(profile))
    portfolio, facts = engine.build(profile, exposure, sim_date)
    data = portfolio.model_dump(mode="json")
    extra = engine.extra_fields(portfolio, exposure) if hasattr(engine, "extra_fields") else {}
    if "baseline_overlap_score" in extra:
        data["baseline_overlap_score"] = extra["baseline_overlap_score"]
    for pos, ex in zip(data["positions"], extra.get("positions", [])):
        pos["reason"] = ex.get("reason", "")
    flags = extra.get("flags")
    if flags:
        data["flags"] = flags
    return portfolio, data, facts


@bp.post("/api/portfolio")
def portfolio():
    engine = None if use_mocks() else _engine()
    if engine is None:
        return _mock_response("portfolio")
    from ai.functions import explain
    from models import Profile
    body = request.get_json(force=True)
    profile_dict, sim_date = body["profile"], body["sim_date"]
    from engine.personas import remember
    remember(Profile(**profile_dict))  # so /api/replay can find this person by name, even on a cache hit
    key = _cache_key(profile_dict, sim_date)
    cached = _CACHE.get(key)
    if cached is not None:
        resp = jsonify(cached)
        resp.headers["X-Cache"] = "hit"
        return resp
    pf, data, facts = _build_one(engine, Profile(**profile_dict), sim_date)
    payload = {"portfolio": data, "explanation": explain(pf, facts),
               "facts": [f.model_dump(mode="json") for f in facts]}
    _CACHE[key] = payload
    resp = jsonify(payload)
    resp.headers["X-Cache"] = "miss"
    return resp


@bp.post("/api/compare")
def compare():
    engine = None if use_mocks() else _engine()
    if engine is None:
        return _mock_response("compare")
    from models import Profile
    body = request.get_json(force=True)
    sim_date = body["sim_date"]
    out = []
    for p in body["profiles"]:
        key = "compare|" + _cache_key(p, sim_date)
        if key in _CACHE:
            out.append(_CACHE[key])
            continue
        data = _build_one(engine, Profile(**p), sim_date)[1]
        _CACHE[key] = data
        out.append(data)
    return jsonify({"portfolios": out})
