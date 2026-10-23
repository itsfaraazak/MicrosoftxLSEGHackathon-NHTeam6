# backend/engine/portfolio.py
from __future__ import annotations

from datetime import date

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


EMERGENCY_FUND_MONTHS_MIN = 3.0
EMPLOYER_CONCENTRATION_PCT = 0.10
ETF_CAP_PCT = 0.25


def advisory_flags(profile: Profile, positions: list[Position], total_assets: float) -> list[str]:
    """Flags that the PDF asks for but that don't change the fixed $100k investable pot in this
    demo -- they are advice surfaced alongside the portfolio, not a reallocation. (Rule 1 covers
    the <5y safe bucket already handled in build(); this covers the <3mo emergency-fund check,
    high-interest debt, employer-concentration caps and the UK/USD currency note.)"""
    flags: list[str] = []

    if profile.emergency_fund_months < EMERGENCY_FUND_MONTHS_MIN:
        flags.append(
            f"Emergency fund covers only {profile.emergency_fund_months:g} months of expenses "
            f"(below the {EMERGENCY_FUND_MONTHS_MIN:g}-month minimum) -- consider building this "
            "before investing further."
        )

    if profile.high_interest_debt:
        flags.append(
            "You reported high-interest debt. Its interest rate likely exceeds expected "
            "investment returns, so paying it off first is usually the better move."
        )

    for h in profile.holdings:
        if h.is_employer_stock and total_assets > 0 and h.amount_usd / total_assets > EMPLOYER_CONCENTRATION_PCT:
            pct = h.amount_usd / total_assets * 100
            flags.append(
                f"{h.ticker} employer shares are {pct:.0f}% of your investable assets, above the "
                f"{EMPLOYER_CONCENTRATION_PCT * 100:g}% concentration guideline -- consider diversifying."
            )

    for p in positions:
        if p.bucket == "growth" and total_assets > 0 and p.amount_usd / total_assets > ETF_CAP_PCT + 1e-6:
            pct = p.amount_usd / total_assets * 100
            flags.append(f"{p.ticker} is {pct:.0f}% of assets, above the {ETF_CAP_PCT * 100:g}% single-ETF cap.")

    if profile.location.strip().lower() in {"london", "manchester", "aberdeen", "uk", "united kingdom"}:
        flags.append(
            "All holdings are USD-denominated ETFs; as a UK-based client you carry GBP/USD "
            "currency risk on top of market risk."
        )

    return flags


# ---------------------------------------------------------------------------
# Rule 3: risk mix in growth bucket
# ---------------------------------------------------------------------------
def risk_mix(risk_tolerance: str, contradictions: list[str]) -> tuple[float, float]:
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
) -> tuple[list[Position], list[Fact]]:
    """Sector ETFs + international. Halve sectors present in client exposure."""
    if stock_usd <= 0:
        return [], []

    positions: list[Position] = []
    facts: list[Fact] = []

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
    raw: dict[str, float] = {}
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
# Rule 5: caps -- no single ETF above 25% of total assets. Overflow is redistributed
# proportionally across the other growth positions that still have headroom, so the total
# stays exactly intact (safe-bucket positions are never capped: that money is earmarked for a
# near-term goal and must not be pushed into growth ETFs).
# ---------------------------------------------------------------------------
def apply_caps(positions: list[Position], total_assets: float) -> list[Position]:
    cap = ETF_CAP_PCT * total_assets
    pos = list(positions)
    for _ in range(4):  # a few passes are enough to settle for our small position counts
        overflow = 0.0
        next_pos: list[Position] = []
        for p in pos:
            if p.bucket == "growth" and p.amount_usd > cap:
                overflow += p.amount_usd - cap
                next_pos.append(p.model_copy(update={"amount_usd": cap}))
            else:
                next_pos.append(p)
        pos = next_pos
        if overflow <= 1e-6:
            break
        room = [(i, cap - p.amount_usd) for i, p in enumerate(pos)
                if p.bucket == "growth" and p.amount_usd < cap]
        total_room = sum(r for _, r in room)
        if total_room <= 1e-6:
            break
        for i, r in room:
            pos[i] = pos[i].model_copy(update={"amount_usd": pos[i].amount_usd + overflow * (r / total_room)})
    return pos


# ---------------------------------------------------------------------------
# Overlap score + baseline
# ---------------------------------------------------------------------------
def compute_overlap_score(positions: list[Position], exposure: ExposureMap) -> float:
    total = sum(p.amount_usd for p in positions)
    if total <= 0 or not exposure.sectors:
        return 0.0

    portfolio_sectors: dict[str, float] = {}
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
) -> tuple[Portfolio, list[Fact]]:
    sim_d = date.fromisoformat(sim_date)
    total_assets = TOTAL_ASSETS_USD

    safe_usd = safe_bucket_amount(profile, total_assets)
    growth_usd = total_assets - safe_usd

    stock_pct, bond_pct = risk_mix(profile.risk_tolerance, profile.contradictions)
    stock_usd = growth_usd * stock_pct
    bond_usd = growth_usd * bond_pct

    positions: list[Position] = []
    facts: list[Fact] = []

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
        flags=advisory_flags(profile, positions, total_assets),
    )
    return portfolio, facts


# Extra fields that the route can merge into the JSON response.
def extra_fields(portfolio: Portfolio, exposure: ExposureMap) -> dict:
    return {
        "baseline_overlap_score": baseline_overlap(exposure),
        "positions": [
            {"reason": _readable_reason(p, exposure)} for p in portfolio.positions
        ],
        "flags": portfolio.flags,
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
