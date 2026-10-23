"""Deterministic checks that run BEFORE the LLM. Rules live in code, not in the prompt."""
import re

TICKERS = {"BIL", "SHY", "BND", "TIP", "VTI", "VXUS", "VT", "XLK", "XLC", "XLV", "XLP", "XLU",
           "XLE", "XLF", "XLI", "XLRE", "QQQ"}
SECTORS = ["Technology", "Communication Services", "Health Care", "Consumer Staples", "Utilities",
           "Energy", "Financials", "Industrials", "Real Estate", "Consumer Discretionary", "Materials"]

FUTURE = re.compile(
    r"\b(will|going to|predict|forecast|next (year|month|quarter)|what happens|crash|rally|"
    r"after (this|today)|in 20(2[2-9]|[3-9]\d)|will .* (rise|fall|go up|go down))\b", re.IGNORECASE)
INJECTION = re.compile(
    r"(ignore (all |your |previous |the )*(rules|instructions)|system prompt|you are now|"
    r"disregard|jailbreak|developer mode|buy (one |a )?(meme|crypto|bitcoin|doge)|put (it )?all in)", re.IGNORECASE)
REFUSE_FUTURE = ("I only use data up to today's simulation date ({sim_date}) and I don't predict "
                 "what markets will do. I can explain what your portfolio holds and why.")
REFUSE_INJECTION = ("I can't change my rules. Holdings come only from our approved ETF list and "
                    "are decided by code, not by chat.")
DISTRESS = re.compile(r"(can't cope|panic|suicid|desperate|lost everything|no way out|hopeless)", re.IGNORECASE)
REFUSE_DISTRESS = ("This sounds stressful. Please consider speaking to a human adviser or a "
                   "support service before making any money decisions.")


def pre_filter(question: str, sim_date: str) -> str | None:
    """Return a refusal string if the question must not reach the LLM, else None."""
    if INJECTION.search(question):
        return REFUSE_INJECTION
    if DISTRESS.search(question):
        return REFUSE_DISTRESS
    if FUTURE.search(question):
        return REFUSE_FUTURE.format(sim_date=sim_date)
    return None


def fence(user_text: str) -> str:
    """Wrap untrusted user text so the model treats it as data."""
    clean = user_text.replace("<<<", "").replace(">>>", "")
    return f"<<<USER_TEXT\n{clean}\nUSER_TEXT>>>"
