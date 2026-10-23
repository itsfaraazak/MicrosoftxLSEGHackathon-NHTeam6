"""Reject LLM text containing any number that is not backed by a Fact."""
import re

from pydantic import BaseModel

NUM = re.compile(r"\d[\d,]*\.?\d*")


class Fact(BaseModel):
    id: str
    value: float
    unit: str
    source: str
    as_of: str


def _variants(v: float) -> set[float]:
    return {round(v, 0), round(v, 1), round(v, 2), round(abs(v), 1), round(v * 100, 1)}


def check(text: str, facts: list[Fact], allow: set[float] | None = None) -> list[str]:
    """Return numbers in text not found in facts. Empty list = approved."""
    allowed = set(allow or set())
    for f in facts:
        allowed |= _variants(f.value)
    bad = []
    for m in NUM.findall(text):
        n = float(m.replace(",", "").rstrip("."))
        if n not in allowed and round(n, 1) not in allowed:
            bad.append(m)
    return bad
