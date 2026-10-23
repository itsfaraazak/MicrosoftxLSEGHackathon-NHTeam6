import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from ai.number_check import check
from engine import data_clock
from models import Fact
from quant import metrics
from quant.proof import build_proof

PF = json.loads((Path(__file__).parent.parent / "mocks" / "portfolio.json").read_text())["portfolio"]
TICKERS = ["SHY", "VTI", "VXUS", "XLV", "BND", "QQQ"]


@pytest.fixture
def prices(monkeypatch, tmp_path):
    idx = pd.bdate_range("2015-01-01", "2021-12-31")
    rng = np.random.default_rng(1)
    drift = {"SHY": 0.00005, "VTI": 0.0004, "VXUS": 0.0002, "XLV": 0.0004, "BND": 0.0001, "QQQ": 0.0007}
    vol = {"SHY": 0.001, "VTI": 0.011, "VXUS": 0.011, "XLV": 0.009, "BND": 0.003, "QQQ": 0.015}
    df = pd.DataFrame({t: 100 * np.cumprod(1 + rng.normal(drift[t], vol[t], len(idx))) for t in TICKERS}, index=idx)
    df.loc[:"2016-06-30", "VXUS"] = np.nan  # later inception
    df.index.name = "Date"
    csv = tmp_path / "prices.csv"
    df.to_csv(csv)
    monkeypatch.setattr(data_clock, "_PRICES", df)
    monkeypatch.setattr(data_clock, "PRICES_CSV", csv)
    return csv


def test_metrics_known_values():
    v = pd.Series([100, 120, 90, 110], index=pd.date_range("2020-01-01", periods=4, freq="D"))
    assert metrics.max_drawdown(v) == pytest.approx(-0.25)
    assert metrics.overlap({"A": 0.5, "B": 0.5}, {"A": 0.4}) == pytest.approx(0.2)
    assert metrics.window_return(v, "2020-01-02", "2020-01-04") == pytest.approx(-0.0833, abs=1e-3)


def test_proof_shape_and_no_lookahead(prices):
    p = build_proof(None, PF, "2021-06-01")
    mock = json.loads((Path(__file__).parent.parent / "mocks" / "proof.json").read_text())
    assert set(p) == set(mock)
    assert p["window"]["to"] <= "2021-05-31"
    assert p["window"]["from"] >= "2016-07-01"  # common start after VXUS inception
    assert all(s["to"] <= "2021-05-31" for s in p["stress"])
    assert [m["id"] for m in p["metrics"]] == [m["id"] for m in mock["metrics"]]
    for c in p["claims"]:
        assert c["verdict"] in {"supported", "not_supported", "inconclusive"}
    for f in p["facts"]:
        Fact(**f)
    for c in p["code"]:
        assert c["source"].startswith("def ") and len(c["sha256"]) == 64


def test_script_reproduces_numbers(prices, tmp_path):
    p = build_proof(None, PF, "2021-06-01")
    script = tmp_path / "s.py"
    script.write_text(p["script"])
    out = json.loads(subprocess.run([sys.executable, str(script), str(prices)], capture_output=True, text=True,
                                    check=True).stdout)
    for m in p["metrics"]:
        if m["id"] == "tech_overlap":
            continue
        assert out["strategy"][m["id"]] == pytest.approx(m["strategy"], abs=1e-9)
        assert out["baseline"][m["id"]] == pytest.approx(m["baseline"], abs=1e-9)
    assert out["stress"] == p["stress"]


def test_number_check_covers_proof_facts(prices):
    p = build_proof(None, PF, "2021-06-01")
    facts = [Fact(**f) for f in p["facts"]]
    mdd = next(f for f in facts if f.id == "proof_mdd_strategy").value
    assert check(f"Its worst fall from a peak was {mdd}%.", facts) == []
    assert check("Its worst fall from a peak was 91.37%.", facts) != []


def test_route_computes_and_validates(prices, monkeypatch):
    from app import app
    monkeypatch.setenv("USE_MOCKS", "0")
    c = app.test_client()
    if "/api/proof" not in {r.rule for r in app.url_map.iter_rules()}:
        pytest.skip("blueprint not registered yet")
    assert c.post("/api/proof", json={"sim_date": "2021-06-01"}).status_code == 200
    assert c.post("/api/proof", json={"sim_date": "garbage"}).status_code == 422
    assert c.post("/api/proof", json={"sim_date": "2021-06-01", "portfolio": {"positions": []}}).status_code == 422
    assert c.get("/api/proof/script?sim_date=2021-06-01").mimetype == "text/plain"
