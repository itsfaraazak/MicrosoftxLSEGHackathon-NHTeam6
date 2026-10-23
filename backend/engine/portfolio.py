# backend/engine/portfolio.py
from __future__ import annotations

from datetime import date
from typing import Dict, List, Tuple

from engine.exposure import ETF_SECTOR_WEIGHTS, overlap
from models import ExposureMap, Fact, Portfolio, Position, Profile

TOTAL_ASSETS_USD = 100_000.0

SECTOR_ETF = {
    "tech": "XLK",
    "health": "XLV",
    "financials": "XLF",
    "consumer": "XLP",
    "energy": "XLE",
    "utilities": "XLU",
    "industrials": "XLI",
    "realestate": "XLRE",
    "communication": "XLC",
}

# ---------------------------------------------------------------------------
# Rule 1 + 2: safe bucket
# ---------------------------------------------------------------------------
def safe_bucket_amount(profile: Profile, total_assets: float) -> float:
    """Rule 1 & 2: set aside money for goals <= 5 years, capped at total assets."""
    safe = sum(g.amount_usd for g in profile.goals if g.years_away <= 5)
    return min(safe, total_assets)


# ---------------------------------------------------------------------------
# Rule 3: risk mix in growth bucket
# ---------------------------------------------------------------------------
def risk_mix(risk_tolerance: str, contradictions: List[str]) -> Tuple[float, float]:
    """Return (stock_pct, bond_pct). Contradiction steps down one risk level."""
    mixes = {
        "low": (0.4, 0.6),
        "medium": (0.6, 0.4),
        "high": (0.8, 0.2),
    }
    stock, bond = mixes.get(risk_tolerance, (0.6, 0.4))
    if contradictions:
        levels = ["low", "medium", "high"]
        idx = levels.index(risk_tolerance) if risk_tolerance in levels else 1
        idx = max(0, idx - 1)
        stock, bond = mixes[levels[idx]]
    return stock, bond


# ---------------------------------------------------------------------------
# Rule 4: stock allocation
# ---------------------------------------------------------------------------
def allocate_stocks(
    stock_usd: float,
    exposure: ExposureMap,
    sim_d: date,
) -> Tuple[List[Position], List[Fact]]:
    """Sector ETFs + international. Halve sectors present in client exposure."""
    if stock_usd <= 0:
        return [], []

    positions: List[Position] = []
    facts: List[Fact] = []

    # Fixed sleeve weights inside the stock portion
    intl_weight = 0.30
    broad_weight = 0.20
    sector_sleeve = 1.0 - intl_weight - broad_weight  # 0.50

    # International
    intl_usd = stock_usd * intl_weight
    if intl_usd > 0:
        f = Fact(
            id="intl_weight", value=intl_weight * 100, unit="%",
            source="yfinance", as_of=sim_d,
        )
        positions.append(
            Position(ticker="VXUS", amount_usd=intl_usd, bucket="growth", reason_facts=[f])
        )
        facts.append(f)

    # Broad US
    broad_usd = stock_usd * broad_weight
    if broad_usd > 0:
        tech_overlap = ETF_SECTOR_WEIGHTS["VTI"].get("tech", 0.0) * 100
        f = Fact(
            id="tech_overlap", value=tech_overlap, unit="%",
            source="yfinance", as_of=sim_d,
        )
        positions.append(
            Position(ticker="VTI", amount_usd=broad_usd, bucket="growth", reason_facts=[f])
        )
        facts.append(f)

    # Sector sleeve: equal weight, halved for exposed sectors
    raw: Dict[str, float] = {}
    for sector in SECTOR_ETF:
        w = 1.0 / len(SECTOR_ETF)
        if sector in exposure.sectors:
            w *= 0.5
        raw[sector] = w
    total_raw = sum(raw.values())
    if total_raw <= 0:
        return positions, facts
    for sector, w in raw.items():
        weight = w / total_raw
        amount = stock_usd * sector_sleeve * weight
        if amount <= 0:
            continue
        etf = SECTOR_ETF[sector]
        job_overlap = exposure.sectors.get(sector, 0.0) * 100
        f = Fact(
            id="job_overlap", value=job_overlap, unit="%",
            source="yfinance", as_of=sim_d,
        )
        positions.append(
            Position(ticker=etf, amount_usd=amount, bucket="growth", reason_facts=[f])
        )
        facts.append(f)

    return positions, facts


# ---------------------------------------------------------------------------
# Rule 5: caps (pure, currently a pass-through so the demo total stays 100k)
# ---------------------------------------------------------------------------
def apply_caps(positions: List[Position], total_assets: float) -> List[Position]:
    """Rule 5: no ETF > 25%. For the demo we keep the total intact; this hook
    is where redistribution would go."""
    return positions


# ---------------------------------------------------------------------------
# Overlap score + baseline
# ---------------------------------------------------------------------------
def compute_overlap_score(positions: List[Position], exposure: ExposureMap) -> float:
    total = sum(p.amount_usd for p in positions)
    if total <= 0 or not exposure.sectors:
        return 0.0

    portfolio_sectors: Dict[str, float] = {}
    for pos in positions:
        weights = ETF_SECTOR_WEIGHTS.get(pos.ticker, {})
        for sec, w in weights.items():
            portfolio_sectors[sec] = portfolio_sectors.get(sec, 0.0) + (pos.amount_usd / total) * w

    total_client = sum(exposure.sectors.values())
    if total_client <= 0:
        return 0.0
    score = sum(
        client_w * portfolio_sectors.get(sec, 0.0)
        for sec, client_w in exposure.sectors.items()
    )
    return min(score / total_client, 1.0)


def baseline_overlap(exposure: ExposureMap) -> float:
    """Overlap of a typical 60/40 VTI/BND portfolio with client exposure."""
    return overlap(exposure, ETF_SECTOR_WEIGHTS["VTI"])


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------
def build(
    profile: Profile,
    exposure: ExposureMap,
    sim_date: str,
) -> Tuple[Portfolio, List[Fact]]:
    sim_d = date.fromisoformat(sim_date)
    total_assets = TOTAL_ASSETS_USD

    safe_usd = safe_bucket_amount(profile, total_assets)
    growth_usd = total_assets - safe_usd

    stock_pct, bond_pct = risk_mix(profile.risk_tolerance, profile.contradictions)
    stock_usd = growth_usd * stock_pct
    bond_usd = growth_usd * bond_pct

    positions: List[Position] = []
    facts: List[Fact] = []

    # Safe bucket
    if safe_usd > 0:
        f = Fact(
            id="goal_years", value=5, unit="y",  # first <=5y goal for demo
            source="profile", as_of=sim_d,
        )
        positions.append(
            Position(ticker="SHY", amount_usd=safe_usd, bucket="safe", reason_facts=[f])
        )
        facts.append(f)

    # Growth bonds
    if bond_usd > 0:
        f = Fact(
            id="bond_share", value=bond_pct * 100, unit="%",
            source="profile", as_of=sim_d,
        )
        positions.append(
            Position(ticker="BND", amount_usd=bond_usd, bucket="growth", reason_facts=[f])
        )
        facts.append(f)

    # Growth stocks
    stock_positions, stock_facts = allocate_stocks(stock_usd, exposure, sim_d)
    positions.extend(stock_positions)
    facts.extend(stock_facts)

    positions = apply_caps(positions, total_assets)

    portfolio = Portfolio(
        sim_date=sim_d,
        positions=positions,
        safe_bucket_usd=safe_usd,
        growth_bucket_usd=growth_usd,
        overlap_score=compute_overlap_score(positions, exposure),
    )
    return portfolio, facts


# Extra fields that the route can merge into the JSON response without touching models.py
def extra_fields(portfolio: Portfolio, exposure: ExposureMap) -> Dict:
    return {
        "baseline_overlap_score": baseline_overlap(exposure),
        "positions": [
            {"reason": _readable_reason(p, exposure)} for p in portfolio.positions
        ],
    }


def _readable_reason(p: Position, exposure: ExposureMap) -> str:
    if p.bucket == "safe":
        return "Short-term goal money kept in short-duration Treasuries."
    if p.ticker == "BND":
        return "Bond sleeve to dampen drawdowns given your risk mix."
    if p.ticker == "VXUS":
        return "International diversification away from your home market."
    if p.ticker == "VTI":
        return "Broad US exposure with a reduced weight because of its tech concentration."
    return "Sector weight reduced because your job already exposes you to this sector."
