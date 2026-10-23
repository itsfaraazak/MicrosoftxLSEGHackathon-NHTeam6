"""What data does the app actually have? Answered in CODE, never guessed by the LLM.

Before this module, a question like "do you have recent data?" reached the model, whose prompt says
"use only the facts, otherwise say you don't know". None of the facts describe the data itself, so it
answered "I don't have access", even after Go live. Here the answer is built from the data clock.

Nothing here weakens the look-ahead rule: market facts still go through data_clock.get_prices(), which
cannot return a row after sim_date. In 2022 mode the answer deliberately does not reveal how far the
price file extends.
"""
import re
from datetime import date

from ai import guardrails
from models import Fact

# Questions ABOUT the app's data (coverage, freshness, sources), not about the market.
_DATA_Q = re.compile(
    r"\b(recent|latest|fresh|current|up[- ]?to[- ]?date|real[- ]?time|live)\b.{0,25}\b(data|prices?|quotes?|information|info|numbers|market data)\b|"
    r"\bdo you (have|know|see|get|use|support)\b.{0,30}\b(access|data|prices|quotes|today|now|latest|current|recent|live|news)\b|"
    r"\b(how|when)\b.{0,20}\b(recent|current|old|fresh|up[- ]?to[- ]?date|stale|updated?)\b.{0,30}\b(data|prices?|is it|are you|your)\b|"
    r"\b(what|which)\b.{0,15}\b(data|sources?|prices|dates?)\b.{0,25}\b(do you|are you|have|use|using|cover|available)\b|"
    r"\bdata\b.{0,12}\b(cut-?off|go(es)? (up )?to|stops?|ends?|range|coverage|as of|date)\b|"
    r"\bas of when\b|\bwhat('?s| is) (today'?s |the )?(current |today'?s )?date\b|\bhow far (back|does your data)\b|"
    r"\b(are|is) (your|the) (data|prices?|numbers?) (current|recent|live|up[- ]?to[- ]?date|old|stale)\b",
    re.IGNORECASE,
)

# Questions about recent market movement: we can answer these from the closing prices we do have.
_RECENT_MARKET_Q = re.compile(
    r"\b(this|last|past) (week|month)\b|\btoday\b|\byesterday\b|\blatest (price|close|level)\b|\bcurrent(ly)? (price|level)\b|"
    r"\b(price|close|level) (today|now)\b|\bhow (is|are|has|have) .{0,30}\b(doing|done|performed|gone)\b|\bright now\b|\blately\b",
    re.IGNORECASE,
)

_PRICE_DATA_END_NOTE = "I don't have news, earnings, intraday prices or anything about individual company shares."


def _fmt(iso: str) -> str:
    y, m, d = (int(x) for x in iso[:10].split("-"))
    return f"{d} {date(y, m, d).strftime('%b')} {y}"


def is_data_question(question: str) -> bool:
    return any(_DATA_Q.search(v) for v in guardrails._views(question)[:1])


def is_recent_market_question(question: str) -> bool:
    return any(_RECENT_MARKET_Q.search(v) for v in guardrails._views(question)[:1])


def latest_on_disk() -> str | None:
    """Newest trading day in prices.csv, or None when the price file isn't available."""
    try:
        from engine import data_clock
        return data_clock.latest_date() or None
    except (FileNotFoundError, OSError):
        return None


def describe_data(sim_date: str, latest: str | None = None, today: date | None = None) -> str:
    """Truthful one-paragraph description of what data the app has at this simulation date."""
    latest = latest if latest is not None else latest_on_disk()
    sim = sim_date[:10]
    if latest and sim >= latest[:10]:
        today = today or date.today()
        age = (today - date.fromisoformat(latest[:10])).days
        stale = f" That is {age} days old; press Go live again to refresh it." if age >= 4 else ""
        return (f"Yes. I have daily closing prices for 17 ETFs up to {_fmt(latest)}, so I am working with the latest data on file."
                f"{stale} {_PRICE_DATA_END_NOTE} Sector weights inside each fund are fixed estimates from the end of 2021.")
    return (f"My data stops at the simulation date, {_fmt(sim)}, on purpose: that stops the plan from peeking at the future. "
            f"Press Go live to switch to today's closing prices for the 17 ETFs. {_PRICE_DATA_END_NOTE}")


def direct_answer(question: str, sim_date: str, latest: str | None = None, today: date | None = None) -> str | None:
    """A code-built answer when the question is about the app's data itself, else None."""
    return describe_data(sim_date, latest, today) if is_data_question(question) else None


def data_context(sim_date: str, latest: str | None = None) -> str:
    """One line for the LLM prompt so it never claims to lack data the app really has."""
    latest = latest if latest is not None else latest_on_disk()
    if latest and sim_date[:10] >= latest[:10]:
        return (f"Data you have: daily closing prices for 17 ETFs up to {latest[:10]}. You have no news, earnings or intraday prices. "
                f"Never say you lack access to the prices listed in the facts; if a question needs news or events, say you only have closing prices.")
    return (f"Data you have: daily closing prices for 17 ETFs up to {sim_date[:10]}, the simulation date, and nothing later by design. "
            f"You have no news, earnings or intraday prices.")


def dedupe_facts(facts: list[Fact]) -> list[Fact]:
    """Same id, value, unit, source and date = same fact. The engine emits one job_overlap per sector ETF."""
    seen: set[tuple] = set()
    out: list[Fact] = []
    for f in facts:
        key = (f.id, round(float(f.value), 6), f.unit, f.source, str(f.as_of))
        if key not in seen:
            seen.add(key)
            out.append(f)
    return out


def market_facts(question: str, sim_date: str, prices=None) -> list[Fact]:
    """Latest close and 1-week change for the tickers asked about (default QQQ and VTI), computed by code.

    Only when the question is about recent market movement. Prices come through the data clock, so nothing
    after sim_date can appear. `prices` lets tests inject a frame.
    """
    if not is_recent_market_question(question):
        return []
    named = [t for t in guardrails.TICKERS if re.search(rf"\b{t}\b", question, re.IGNORECASE)]
    tickers = named or ["QQQ", "VTI"]
    if prices is None:
        try:
            from engine import data_clock
            prices = data_clock.get_prices(tickers, sim_date)
        except (FileNotFoundError, OSError, KeyError):
            return []
    out: list[Fact] = []
    for t in tickers:
        if t not in prices.columns:
            continue
        s = prices[t].dropna()
        if len(s) < 6:
            continue
        as_of = s.index[-1].strftime("%Y-%m-%d")
        out.append(Fact(id=f"last_close_{t.lower()}", value=round(float(s.iloc[-1]), 2), unit="$", source="yfinance", as_of=as_of))
        out.append(Fact(id=f"week_change_{t.lower()}", value=round((float(s.iloc[-1]) / float(s.iloc[-6]) - 1) * 100, 1),
                        unit="%", source="yfinance", as_of=as_of))
    return out
