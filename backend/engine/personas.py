"""The three demo personas (docs/context/PROJECT.md)."""
from models import Goal, Holding, Profile

PERSONAS: dict[str, Profile] = {
    "priya": Profile(
        name="Priya", age=29, job_title="Software engineer", industry="Fintech", employer="", location="London",
        risk_tolerance="high", experience="some", emergency_fund_months=3,
        past_behaviour="Sold everything in March 2020",
        contradictions=["Stated high risk tolerance but sold everything in March 2020"],
        goals=[Goal(name="House deposit", amount_usd=30000, years_away=5)],
        holdings=[Holding(ticker="QQQ", amount_usd=15000)],
    ),
    "tom": Profile(
        name="Tom", age=41, job_title="Nurse", industry="Healthcare (NHS)", employer="NHS", location="Manchester",
        risk_tolerance="medium", experience="none", emergency_fund_months=4,
        goals=[Goal(name="Retirement", amount_usd=400000, years_away=25)],
    ),
    "fiona": Profile(
        name="Fiona", age=35, job_title="Offshore engineer", industry="Oil and gas", employer="Aberdeen Energy",
        location="Aberdeen", risk_tolerance="medium", experience="some", emergency_fund_months=3,
        goals=[Goal(name="Children's education", amount_usd=60000, years_away=10)],
        holdings=[Holding(ticker="XLE", amount_usd=20000, is_employer_stock=True)],
    ),
}


def get_persona(profile_id: str) -> Profile:
    try:
        return PERSONAS[profile_id.lower()]
    except KeyError:
        raise KeyError(f"unknown profile_id {profile_id!r}") from None
