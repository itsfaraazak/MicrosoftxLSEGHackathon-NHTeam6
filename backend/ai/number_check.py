"""Reject LLM text containing any number that is not backed by a Fact."""
import re

from models import Fact

DATE_OR_YEAR = re.compile(r"\b(?:19|20)\d{2}(?:-\d{2}-\d{2})?\b")
NUM = re.compile(r"(\d[\d,]*\.?\d*)\s*([kKmM]\b)?")
SUFFIX = {"k": 1e3, "m": 1e6}


def _variants(v: float) -> set[float]:
    a = abs(v)
    return {round(a, 0), round(a, 1), round(a, 2), round(a * 100, 1)}


def check(text: str, facts: list[Fact], *, sim_year: int | None = None,
          allow: set[float] | None = None) -> list[str]:
    """Return offending numbers/years. Empty list = approved.

    Years and ISO dates are exempt unless later than sim_year (look-ahead leak).
    """
    bad: list[str] = []
    if sim_year is not None:
        bad += [y for y in re.findall(r"\b(?:19|20)\d{2}\b", text) if int(y) > sim_year]
    allowed = set(allow or set())
    for f in facts:
        allowed |= _variants(f.value)
    for num, suffix in NUM.findall(DATE_OR_YEAR.sub(" ", text)):
        n = float(num.replace(",", "").rstrip("."))
        if suffix:
            n *= SUFFIX[suffix.lower()]
        if round(n, 1) not in allowed and round(n, 0) not in allowed:
            bad.append(num + suffix)
    return bad
