"""Keyword job->sector map. Used if the LLM is unavailable or returns junk, so the demo never breaks."""
RULES = [
    (("software", "developer", "engineer", "tech", "data", "it ", "programmer"), {"Technology": 0.6, "Communication Services": 0.2}),
    (("fintech", "bank", "finance", "trader", "insurance", "accountant"), {"Financials": 0.6, "Technology": 0.2}),
    (("nurse", "nhs", "doctor", "health", "pharma", "care"), {"Health Care": 0.3}),
    (("oil", "gas", "energy", "offshore", "petroleum"), {"Energy": 0.7, "Industrials": 0.2}),
    (("teacher", "civil servant", "public sector", "council"), {}),
    (("construction", "manufactur", "logistics", "factory"), {"Industrials": 0.6}),
    (("media", "marketing", "telecom", "journalist"), {"Communication Services": 0.6}),
    (("retail", "shop", "supermarket"), {"Consumer Staples": 0.4, "Consumer Discretionary": 0.3}),
    (("property", "estate", "landlord"), {"Real Estate": 0.6}),
]


def fallback_exposure(job_title: str, industry: str, employer: str = "") -> dict[str, float]:
    text = f" {job_title} {industry} {employer} ".lower()
    out: dict[str, float] = {}
    for words, sectors in RULES:
        if any(w in text for w in words):
            for s, w in sectors.items():
                out[s] = max(out.get(s, 0), w)
    return out
