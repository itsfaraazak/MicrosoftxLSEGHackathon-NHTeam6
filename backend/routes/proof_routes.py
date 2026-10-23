"""OWNER B: POST /api/proof (quant dev in a box) and GET /api/proof/script."""
import json
from pathlib import Path

import pandas as pd
from flask import Blueprint, Response, jsonify, request

from quant.proof import build_proof
from routes._mock import MOCKS, mock, use_mocks

bp = Blueprint("proof", __name__)


def _portfolio_or_default(body: dict) -> dict:
    pf = body.get("portfolio")
    if pf is None:
        pf = json.loads((MOCKS / "portfolio.json").read_text())["portfolio"]
    pos = pf.get("positions") if isinstance(pf, dict) else None
    if not pos or not all(isinstance(p, dict) and isinstance(p.get("ticker"), str)
                          and isinstance(p.get("amount_usd"), (int, float)) and p["amount_usd"] >= 0 for p in pos):
        raise ValueError("portfolio.positions must be a list of {ticker, amount_usd}")
    return pf


def _compute(body: dict) -> dict:
    sim_date = body.get("sim_date")
    try:
        pd.Timestamp(sim_date)
    except Exception as e:
        raise ValueError("sim_date must be YYYY-MM-DD") from e
    if not isinstance(sim_date, str) or len(sim_date) != 10:
        raise ValueError("sim_date must be YYYY-MM-DD")
    return build_proof(body.get("profile"), _portfolio_or_default(body), sim_date)


@bp.post("/api/proof")
def proof():
    if use_mocks():
        return mock("proof")
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify(error="JSON body required"), 422
    try:
        return jsonify(_compute(body))
    except (ValueError, KeyError, TypeError) as e:
        return jsonify(error=str(e)), 422


@bp.get("/api/proof/script")
def proof_script():
    if use_mocks():
        return Response(json.loads((Path(MOCKS) / "proof.json").read_text())["script"], mimetype="text/plain")
    sim_date = request.args.get("sim_date", "2022-01-03")
    try:
        return Response(_compute({"sim_date": sim_date})["script"], mimetype="text/plain")
    except (ValueError, KeyError, TypeError) as e:
        return jsonify(error=str(e)), 422
