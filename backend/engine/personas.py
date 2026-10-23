"""The three demo personas (docs/context/PROJECT.md)."""
from models import Goal, Holding, Profile

PERSONAS: dict[str, Profile] = {
    "priya": Profile(
        name="Priya", age=36, job_title="VP of Engineering", industry="Fintech", employer="", location="London",
        risk_tolerance="high", experience="some", emergency_fund_months=3,
        past_behaviour="Sold everything in March 2020",
        contradictions=["Stated high risk tolerance but sold everything in March 2020"],
        goals=[Goal(name="House deposit", amount_usd=30000, years_away=5)],
        holdings=[Holding(ticker="QQQ", amount_usd=15000)],
    ),
    "tom": Profile(
        name="Tom", age=44, job_title="Hospital consultant", industry="Healthcare (NHS)", employer="NHS", location="Manchester",
        risk_tolerance="medium", experience="none", emergency_fund_months=4,
        goals=[Goal(name="Retirement", amount_usd=400000, years_away=25)],
    ),
    "fiona": Profile(
        name="Fiona", age=38, job_title="Operations director", industry="Oil and gas", employer="Aberdeen Energy",
        location="Aberdeen", risk_tolerance="medium", experience="some", emergency_fund_months=3,
        goals=[Goal(name="Children's education", amount_usd=60000, years_away=10)],
        holdings=[Holding(ticker="XLE", amount_usd=20000, is_employer_stock=True)],
    ),
}


REGISTRY: dict[str, Profile] = {}  # profiles of real users, remembered when their plan is built


def key_for(name: str) -> str:
    return (name.strip().split() or [""])[0].lower()


def remember(profile: Profile) -> None:
    """Called when a plan is built, so the time machine can replay the same person by first name."""
    if key_for(profile.name):
        REGISTRY[key_for(profile.name)] = profile


def get_persona(profile_id: str) -> Profile:
    k = profile_id.strip().lower()
    if k in REGISTRY:
        return REGISTRY[k]  # a profile the user just built wins over a demo persona with the same name
    try:
        return PERSONAS[k]
    except KeyError:
        raise KeyError(f"unknown profile_id {profile_id!r}") from None
