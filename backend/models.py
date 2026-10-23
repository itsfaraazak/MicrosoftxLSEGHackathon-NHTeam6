"""Shared objects = the contract between owners. Change only by 3-way agreement (log in docs/decisions.md)."""
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class Goal(BaseModel):
    name: str
    amount_usd: float
    years_away: float


class Holding(BaseModel):
    ticker: str
    amount_usd: float
    is_employer_stock: bool = False


class Profile(BaseModel):
    name: str
    age: int
    job_title: str
    industry: str
    employer: str = ""
    location: str = ""
    risk_tolerance: Literal["low", "medium", "high"]
    experience: Literal["none", "some", "experienced"] = "none"
    emergency_fund_months: float = 0
    high_interest_debt: bool = False
    past_behaviour: str = ""
    exclusions: list[str] = Field(default_factory=list)
    contradictions: list[str] = Field(default_factory=list)
    goals: list[Goal] = Field(default_factory=list)
    holdings: list[Holding] = Field(default_factory=list)


class Fact(BaseModel):
    id: str
    value: float
    unit: str
    source: str
    as_of: date


class ExposureMap(BaseModel):
    sectors: dict[str, float]  # sector -> weight 0..1 the client's life already depends on
    source: str


class Position(BaseModel):
    ticker: str
    amount_usd: float
    bucket: Literal["safe", "growth"]
    reason_facts: list[Fact] = Field(default_factory=list)
    reason: str = ""


class Portfolio(BaseModel):
    sim_date: date
    positions: list[Position]
    safe_bucket_usd: float
    growth_bucket_usd: float
    overlap_score: float
    baseline_overlap_score: float | None = None
    flags: list[str] = Field(default_factory=list)


class GuardEvent(BaseModel):
    sim_date: date
    drawdown_pct: float
    market_wide: bool
    cost_of_selling_usd: float
    goal_years_away: float
    suggested_action: Literal["hold", "rebalance", "move_to_safe"]
    coach_message: str | None = None


class AgentAction(BaseModel):
    sim_date: date
    ticker: str
    trade_usd: float
    rule_triggered: str
    approved: bool = False
