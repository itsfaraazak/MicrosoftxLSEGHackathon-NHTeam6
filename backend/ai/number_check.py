"""Reject LLM text containing any number that is not backed by a Fact.

Digits are always checked. Spelled-out numbers (one..ninety-nine, hundred, thousand, million) are checked
only when followed by a unit (percent, dollars, years, months, ...), so "one reason" or "no one" never trips it.
"half", "double" and other fuzzy quantities are not checked.
"""
import re
import unicodedata

from ai import rigor
from models import Fact

YEAR = re.compile(r"(?<![\d$£€,.])(?:19|20)\d{2}(?![\d,]|\.\d)")
SHORT_YEAR = re.compile(r"['’](\d{2})\b|\bfy ?(\d{2})\b", re.IGNORECASE)
ISO_DATE = re.compile(r"(?<!\d)(?:19|20)\d{2}-\d{2}-\d{2}(?!\d)")
MONTHS = (r"(?:january|february|march|april|may|june|july|august|september|october|november|december|"
          r"jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\b\.?")
DAY = r"\d{1,2}(?:st|nd|rd|th)?"
DATE_FORMS = re.compile(
    rf"(?<!\d)(?:19|20)\d{{2}}(?:-\d{{2}}-\d{{2}})?(?!\d)|\b{MONTHS}\s+{DAY}\b|\b{DAY}\s+(?:of\s+)?{MONTHS}"
    r"|\b\d{1,2}/\d{1,2}/\d{2,4}\b|(?<=['’])\d{2}\b", re.IGNORECASE)
NAMES = re.compile(r"S&P ?500|Nasdaq[- ]?100|401\(?k\)?|\b[A-Za-z]+\d+\b|\bTop ?\d+\b", re.IGNORECASE)
NUM = re.compile(r"(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s*(k|mm|mn|m|bn|b|thousand|million|billion)?\b", re.IGNORECASE)
SCALE = {"k": 1e3, "thousand": 1e3, "m": 1e6, "mm": 1e6, "mn": 1e6, "million": 1e6,
         "b": 1e9, "bn": 1e9, "billion": 1e9}

_SMALL = {w: i for i, w in enumerate((
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
    "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"))}
_TENS = {w: 10 * i for i, w in enumerate(
    ("twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"), start=2)}
_BIG = {"hundred": 100, "thousand": 1e3, "million": 1e6}
_W = "|".join(sorted([*_SMALL, *_TENS, *_BIG], key=len, reverse=True))
UNITS = r"(?:per ?cent|percent(?:age points?)?|dollars?|bucks|usd|years?|months?|weeks?|days?)"
WORDNUM = re.compile(rf"\b((?:a\s+)?(?:{_W})(?:[\s-]+(?:and\s+)?(?:{_W}))*)\s+(?={UNITS}\b)", re.IGNORECASE)


def _words_to_num(s: str) -> float:
    total = cur = 0.0
    for w in re.split(r"[\s-]+", s.lower()):
        if w in _SMALL:
            cur += _SMALL[w]
        elif w in _TENS:
            cur += _TENS[w]
        elif w == "hundred":
            cur = (cur or 1) * 100
        elif w in _BIG:
            total += (cur or 1) * _BIG[w]
            cur = 0
    return total + cur


def _variants(v: float) -> set[float]:
    a = abs(v)
    return {round(a, 0), round(a, 1), round(a, 2), round(a * 100, 1)}


def check(text: str, facts: list[Fact], *, sim_year: int | None = None,
          allow: set[float] | None = None, sim_date: str | None = None) -> list[str]:
    """Return offending numbers/years. Empty list = approved.

    Years and ISO dates are exempt unless later than sim_year / sim_date (look-ahead leak).
    """
    text = unicodedata.normalize("NFKC", text)
    if sim_year is None and sim_date:
        sim_year = int(sim_date[:4])
    bad: list[str] = []
    if sim_year is not None:
        bad += [y for y in YEAR.findall(text) if int(y) > sim_year]
        bad += ["'" + (a or b) for a, b in SHORT_YEAR.findall(text) if 2000 + int(a or b) > sim_year and int(a or b) <= 40]
    if sim_date:
        bad += [d for d in ISO_DATE.findall(text) if d > sim_date and d[:4] not in bad]
    allowed = set(allow or set())
    for f in facts:
        allowed |= _variants(f.value)

    def ok(n: float) -> bool:
        return round(n, 1) in allowed or round(n, 0) in allowed

    checked = 0
    for m in WORDNUM.finditer(text):
        checked += 1
        if not ok(_words_to_num(m.group(1))):
            bad.append(m.group(1).strip())
    body = NAMES.sub(" ", DATE_FORMS.sub(" ", text))
    for whole, frac, suffix in NUM.findall(body):
        checked += 1
        n = float(whole.replace(",", "") + frac)
        if suffix:
            n *= SCALE[suffix.lower()]
        if not ok(n):
            bad.append(whole + frac + (suffix or ""))
    rigor.note_number_check(checked, bad)
    return bad
