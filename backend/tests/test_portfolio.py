# backend/tests/test_portfolio.py
from datetime import date

import pytest

from engine.exposure import ETF_SECTOR_WEIGHTS
from engine.portfolio import (
    allocate_stocks,
    baseline_overlap,
    build,
    risk_mix,
    safe_bucket_amount,
)
from models import ExposureMap, Goal, Holding, Profile


def _profile(**overrides) -> Profile:
    base = dict(
        name="Priya",
        age=29,
        job_title="Software engineer",
        industry="Fintech",
        employer="London fintech",
        location="London",
        risk_tolerance="high",
        experience="some",
        emergency_fund_months=4,
        high_interest_debt=False,
        past_behaviour="Sold everything in March 2020",
        exclusions=[],
        contradictions=[],
        goals=[Goal(name="House deposit", amount_usd=30000, years_away=5)],
        holdings=[Holding(ticker="QQQ", amount_usd=15000, is_employer_stock=False)],
    )
    base.update(overrides)
    return Profile(**base)


def _exposure() -> ExposureMap:
    return ExposureMap(sectors={"tech": 0.5, "communication": 0.2}, source="test")


def test_safe_bucket_only_counts_goals_within_5y():
    p = _profile(goals=[
        Goal(name="short", amount_usd=30000, years_away=5),
        Goal(name="long", amount_usd=50000, years_away=10),
    ])
    assert safe_bucket_amount(p, 100_000) == 30000


def test_risk_mix_steps_down_on_contradiction():
    stock, bond = risk_mix("high", ["sold in 2020"])
    assert stock == pytest.approx(0.6)
    assert bond == pytest.approx(0.4)


def test_overlap_halves_exposed_sector():
    p = _profile()
    e = _exposure()
    positions, _ = allocate_stocks(50_000, e, date(2022, 1, 3))
    xlk = next(pos for pos in positions if pos.ticker == "XLK")
    xlv = next(pos for pos in positions if pos.ticker == "XLV")
    # tech is halved, health is not: XLK should be smaller than XLV
    assert xlk.amount_usd < xlv.amount_usd


def test_build_returns_100k_and_facts():
    p = _profile()
    port, facts = build(p, _exposure(), "2022-01-03")
    total = sum(pos.amount_usd for pos in port.positions)
    assert total == pytest.approx(100_000)
    assert port.safe_bucket_usd == 30000
    assert port.growth_bucket_usd == 70000
    assert all(pos.reason_facts for pos in port.positions)
    assert facts


def test_overlap_score_between_0_and_1():
    p = _profile()
    port, _ = build(p, _exposure(), "2022-01-03")
    assert 0 <= port.overlap_score <= 1


def test_baseline_overlap_is_vti_tech_weight():
    e = ExposureMap(sectors={"tech": 1.0}, source="test")
    assert baseline_overlap(e) == pytest.approx(ETF_SECTOR_WEIGHTS["VTI"]["tech"])
