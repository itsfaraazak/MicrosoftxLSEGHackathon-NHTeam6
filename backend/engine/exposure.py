"""ETF -> sector weight table + overlap scoring (Owner A).

Sector vocabulary used by this module (and by engine.portfolio): tech, health, financials,
consumer, energy, utilities, industrials, realestate, communication.

The AI layer (ai/functions.map_exposure, ai/exposure_fallback.fallback_exposure) speaks a
different, GICS-style vocabulary (Technology, Communication Services, Health Care, Consumer
Staples, Consumer Discretionary, Utilities, Energy, Financials, Industrials, Real Estate,
Materials) because that's what the LLM prompt and guardrails.SECTORS use. normalize_exposure()
below bridges the two so routes can call engine.build with the right keys.

Weights are APPROXIMATE end-2021 GICS sector weights (a known, documented approximation per the
project PDF), not live data: a pure bond fund is 0% equity-sector exposure, a single-sector SPDR
ETF (XLK/XLC/XLV/XLP/XLU/XLE/XLF/XLI/XLRE) is ~100% its own sector, and the broad/total-market
funds (VTI/VXUS/VT/QQQ) are hand-set blends based on known end-2021 S&P/Nasdaq sector weights.
We also tried a live yfinance cross-check once (see scripts/fetch_etf_sectors.py /
data/etf_sectors.json) to sanity-check these numbers — yfinance's `funds_data.sector_weightings`
reflects TODAY's weights, not end-2021, so it is only a sanity check, never the source of truth
for the sim (the sim must stay deterministic and dated to 2022-01-03).
"""
from __future__ import annotations

from models import ExposureMap

# ---------------------------------------------------------------------------
# ETF -> sector weight (end-2021 approximation)
# ---------------------------------------------------------------------------
ETF_SECTOR_WEIGHTS: dict[str, dict[str, float]] = {
    # Safe / bond funds: no equity sector exposure.
    "BIL": {},
    "SHY": {},
    "BND": {},
    "TIP": {},
    # Broad US total market.
    "VTI": {
        "tech": 0.30, "health": 0.13, "financials": 0.13, "consumer": 0.20,
        "energy": 0.03, "utilities": 0.02, "industrials": 0.08, "realestate": 0.03,
        "communication": 0.08,
    },
    # Ex-US developed + emerging.
    "VXUS": {
        "financials": 0.19, "industrials": 0.13, "consumer": 0.15, "health": 0.09,
        "tech": 0.12, "communication": 0.05, "energy": 0.05, "utilities": 0.03,
        "realestate": 0.03,
    },
    # Global all-world (blend of VTI/VXUS).
    "VT": {
        "tech": 0.23, "financials": 0.15, "health": 0.11, "consumer": 0.18,
        "industrials": 0.10, "communication": 0.07, "energy": 0.04, "utilities": 0.02,
        "realestate": 0.03,
    },
    # Single-sector SPDR ETFs: ~100% their own sector.
    "XLK": {"tech": 1.0},
    "XLC": {"communication": 1.0},
    "XLV": {"health": 1.0},
    "XLP": {"consumer": 1.0},
    "XLU": {"utilities": 1.0},
    "XLE": {"energy": 1.0},
    "XLF": {"financials": 1.0},
    "XLI": {"industrials": 1.0},
    "XLRE": {"realestate": 1.0},
    # Nasdaq-100 (compare-only / employer-stock-adjacent holding), tech + comms heavy.
    "QQQ": {
        "tech": 0.50, "communication": 0.17, "consumer": 0.18, "health": 0.06,
        "industrials": 0.04, "financials": 0.01,
    },
}


def overlap(exposure: ExposureMap, weights: dict[str, float]) -> float:
    """Weighted overlap of an ExposureMap against a single ETF's sector weights, in 0..1.

    weighted by how much of the client's life exposure (exposure.sectors) sits in sectors the
    fund (weights) also holds.
    """
    total = sum(exposure.sectors.values())
    if total <= 0:
        return 0.0
    score = sum(w * weights.get(sector, 0.0) for sector, w in exposure.sectors.items())
    return min(score / total, 1.0)


# ---------------------------------------------------------------------------
# LLM vocabulary -> engine.portfolio vocabulary
# ---------------------------------------------------------------------------
_LLM_TO_ENGINE = {
    "Technology": "tech",
    "Communication Services": "communication",
    "Health Care": "health",
    "Consumer Staples": "consumer",
    "Consumer Discretionary": "consumer",
    "Utilities": "utilities",
    "Energy": "energy",
    "Financials": "financials",
    "Industrials": "industrials",
    "Real Estate": "realestate",
    # No dedicated "materials" bucket in the engine vocabulary; approximate as industrials.
    "Materials": "industrials",
}


def normalize_exposure(exposure: ExposureMap) -> ExposureMap:
    """Map the AI layer's GICS-style sector names onto engine.portfolio's short keys.

    Idempotent: keys already in the engine vocabulary (e.g. "tech") pass through unchanged.
    Sectors that merge (Consumer Staples + Consumer Discretionary -> consumer, or two LLM
    sectors that both map to the same engine key) are summed and clamped to 1.0.
    """
    out: dict[str, float] = {}
    for sector, weight in exposure.sectors.items():
        key = _LLM_TO_ENGINE.get(sector, sector.lower())
        out[key] = min(1.0, out.get(key, 0.0) + weight)
    return ExposureMap(sectors=out, source=exposure.source)
