"""Deterministic checks that run BEFORE the LLM. Rules live in code, not in the prompt."""
import base64
import binascii
import codecs
import re
import unicodedata

TICKERS = {"BIL", "SHY", "BND", "TIP", "VTI", "VXUS", "VT", "XLK", "XLC", "XLV", "XLP", "XLU",
           "XLE", "XLF", "XLI", "XLRE", "QQQ"}
SECTORS = ["Technology", "Communication Services", "Health Care", "Consumer Staples", "Utilities",
           "Energy", "Financials", "Industrials", "Real Estate", "Consumer Discretionary", "Materials"]

MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september",
               "october", "november", "december"]
MARKET = (r"market|tech|stocks?|shares?|rall(y|ies)|crash|price|return|perform|happen|nvidia|qqq|xl[a-z]+|etf|s&p|"
          r"nasdaq|fed\b|rates?|inflation|recession|econom|bitcoin|crypto|tesla|apple|amazon|did\b|do\b|doing")
GOAL = r"goal|deposit|retire\w*|wedding|house|home|tuition|universit\w+|target|withdraw|need the money"
MOVE = (r"crash(es|ed|ing)?|rall(y|ies|ied)|recession|bubble|rebound(ed)?|bounce[sd]?|recover(y|ed|s)?|plunge[sd]?|"
        r"surge[sd]?|collaps\w+|correction|bear market|bull (market|run)|tank(ed|s)?|soar(ed|s)?|melt ?down|"
        r"sell-?off|dip(ped)?")
PAST = (r"last (week|month|year|quarter|few|time)|past (week|month|year|few)|previous|yesterday|\bago\b|"
        r"financial crisis|dot-?com|covid|pandemic|so far|to date|\bytd\b|until now|up to now|recently|since i started")
FORWARD = re.compile(
    r"\bwill\b(?!\s+you\b)|\bwon'?t\b|\bgonna\b|going to|\bpredict\w*|\bforecast\w*|\boutlook\b|\bprojection|"
    r"\bexpect(ed|ing|s)?\b|\banticipat\w+|\bcoming\b|\bnext (year|month|week|quarter|decade|few|big)|"
    r"\btomorrow\b|\b(near|distant|foreseeable) future\b|\bfuture (price|value|return|perform\w*|market)\b|\bgoing forward\b|\bhindsight\b|\bretrospect\b|"
    r"\b(end|rest) of (this|the) year\b|\blater (this|in)\b|\bby (the )?end of\b|\bshould i (wait|hold off)\b|"
    r"\bwait for\b|\bgood time to\b|\bright time\b|\btime the market\b|\bbuy the dip\b|\bsafe to (buy|invest)\b|"
    r"\bworst (is )?(over|yet)\b|\bwhat (happens|would happen|could happen|might happen) (to|if|when|next|after)\b|\bwhat'?s next\b|\bwhat is next\b|"
    r"\b(odds|chances?|probability|likelihood)\b|\blikely to\b|\bdue for\b|\babout to\b|\bset to (rise|fall)\b|"
    r"\b(would|could|might|may)\b.{0,40}\b(rise|fall|go up|go down|drop|climb|crash|rally|recover|rebound)\b|"
    r"\bis (it|the market|tech|qqq|inflation|a recession) (going|gonna)\b|\bwhen (will|does|should|do)\b|"
    r"\bbottom(ed|ing)\b|\bhit(ting)? (the )?bottom\b|\bafter (this|today|now)\b|\bsince then\b|"
    r"\bwhat if (i|we) had\b|\btime travel|\bcrystal ball\b",
    re.IGNORECASE)
POST_EVENTS = re.compile(
    r"\b(ftx|terra ?luna|\bluna\b|svb|silicon valley bank|chat ?gpt|gpt-?4|invasion of ukraine|russia(n)? invad\w*|"
    r"ukraine war|inflation reduction act|rate hikes? of 2022)\b", re.IGNORECASE)
EDUCATIONAL = re.compile(r"^\W*(what('s| is| are| does)|define|explain|meaning of|can you explain|tell me about)\b", re.IGNORECASE)
YEAR = re.compile(r"(?<![\d$£€,.])(19|20)(\d{2})(?![\d,]|\.\d)")
SHORT_YEAR = re.compile(r"['’](2[2-9]|3\d)\b|\bfy ?(2[2-9]|3\d)\b|\b(h[12]|q[1-4]) ?['’]?(2[2-9])\b", re.IGNORECASE)
SPOKEN_YEAR = re.compile(r"\btwenty[ -]?(twenty|thirty|forty)\b|\btwo thousand (and )?(twenty|thirty)", re.IGNORECASE)

ACTION = r"(buy|buying|add|adding|include|put|invest(ing)? in|allocate|purchase|swap|switch to|load up on|go (all )?in on|yolo|short|get me)"
OFFLIST = (r"meme|crypto\w*|bitcoin|btc|ether(eum)?|eth\b|doge(coin)?|shib\w*|solana|nfts?|gamestop|gme|amc|tesla|tsla|"
           r"nvidia|nvda|apple|aapl|amazon|amzn|meta\b|google|alphabet|microsoft|msft|netflix|any single stock|"
           r"(an? |one |some )?(single|individual) stocks?|penny stocks?|leveraged|tqqq|sqqq|options|futures|margin|"
           r"private equity|gold|silver|oil|real estate|property|\$[a-z]{1,5}\b")
_ASSET_WORDS = "system|hidden|initial|original|secret|above|previous"
_REVEAL = (r"(repeat|print|show|reveal|display|output|translate|recite|leak|tell me|share|summari[sz]e|paste|dump|"
           r"write out|give me|what (are|were)|what'?s)")
INJECTION = re.compile(
    r"(ignor\w*|disregard|forget|override|overrule|bypass|skip|discard|neglect|unlearn|"
    r"turn off|disable|circumvent)\W+(?:\w+\W+){0,5}?"
    r"(rules?|instructions?|guidelines?|prompts?|restrictions?|constraints?|guardrails?|programming|training|"
    r"caps?|limits?|safeguards?|filters?|policy|policies|directives?)|"
    r"system ?prompts?|developer (message|prompt|mode)|hidden prompt|god ?mode|jail ?break\w*|\bdan\b|do anything now|"
    r"you are (now |no longer |actually )|\byou'?re (now |no longer )|from now on|new persona|\bpersona\b|"
    r"\b(role-?play\w*|pretend\w*|simulate being|imagine you are|unfiltered|uncensored|unrestricted|no restrictions|"
    r"without (any )?(rules|restrictions|limits|filters))\b|"
    r"\b(act|behave|respond|answer|speak|talk) (as|like) (if you|an? (ai|assistant|advis[eo]r|bot|model|unrestricted|"
    r"trader|hacker|different|human|pirate|evil)|my |dan\b)|"
    r"\b(pretend|assume|imagine|suppose|let'?s say)\b.{0,15}\b(it'?s|it is|today is|the date is|we are in|now is|the year is)|"
    r"\b(disregard|forget)\W+(?:\w+\W+){0,3}?(above|previous|prior|earlier|everything|all that)\b|"
    r"\b(change|set|reset|update|alter|move|jump|skip|advance)\b.{0,15}\b(sim\w*|today'?s|current|system) ?(date|clock)\b|"
    r"\b(fast[- ]?forward|time ?travel|jump (ahead|forward))\b|"
    rf"\b{_REVEAL}\b.{{0,25}}\byour ({_ASSET_WORDS} |first |full |exact )?(prompt|instructions?|rules|guidelines|message|"
    r"configuration|setup|programming|constraints)\b|"
    rf"\b{_REVEAL}\b.{{0,25}}\bthe ({_ASSET_WORDS}) (prompt|instructions?|rules|message)\b|\beverything above\b|\bverbatim\b|"
    r"base ?64|\brot-?13\b|\bhex(adecimal)? (encoded|string)|\bdecode (this|the following|it)\b|\bencoded (message|instruction)|"
    r"</?\s*(system|assistant|user|instructions?|prompt)\b|\[/?\s*(inst|system)\s*\]|#{2,}\s*(system|instruction)|"
    r"^\s*(system|assistant)\s*:|<<<|>>>|user_text|"
    r"\b(ignora|ignorez|ignoriere|ignorar|ignorer)\w*\b.{0,25}(instruc|regl|regeln|anweis|consign)",
    re.IGNORECASE | re.MULTILINE)
EXPLAINS = re.compile(r"^\W*(why (?!not\b|don'?t\b|can'?t\b|shouldn'?t\b)|how come|what (is|does|are)\b)", re.IGNORECASE)
CLAUSES = re.compile(r"[.?!;\n,]+|\b(?:and|also|then|but|plus)\b", re.IGNORECASE)
OVERRIDE = re.compile(
    rf"\b{ACTION}\b.{{0,40}}\b({OFFLIST})|"
    r"\b(good|worth|safe) (a )?(buy|buying|investment)\b.{0,25}\b(tesla|nvidia|apple|amazon|bitcoin|crypto|gamestop|meme)|"
    r"\b(put|move|invest|allocate|shift|dump|pour|stick|switch|go|plow|bet|stake)\b.{0,30}"
    r"(\b(1[01]\d|[4-9]\d) ?(%|percent|per cent)|\ball of it\b|\bit all\b|\ball (of )?(my|the|money|savings|cash)\b|"
    r"\beverything\b|\bthe (whole|entire)\b|\ball[- ]in\b)|"
    r"\b(want|need|make|set|give me)\b.{0,25}\b([4-9]\d|1[01]\d) ?(?:%|percent)(?!\w).{0,20}\b(in|into|to|tech|xl\w+|qqq|vti)\b|"
    r"\b(raise|increase|lift|exceed|remove|ignore|override|change|bypass|disable|turn off|without|no)\b"
    r".{0,15}\b(cap|limit|maximum|max|threshold|guardrail|rule)s?\b",
    re.IGNORECASE)
DISTRESS = re.compile(
    r"(can'?t cope|panic|suicid\w*|kill myself|end it all|self[- ]?harm|hurt myself|harm myself|want to die|"
    r"don'?t want to (live|be here)|desperate|lost everything|no way out|hopeless|can'?t go on|give up on life|"
    r"can'?t (sleep|breathe|eat|take (it|this))|losing sleep|terrified|scared to death|crying|breaking down|"
    r"falling apart|anxiety|anxious|(?<!great )depress\w*|worthless|ruined|"
    r"life savings|last (penny|dollar|cent|pound)|rent money|can'?t (pay|afford)|behind on (rent|bills|payments)|"
    r"payday loan|homeless|made redundant|lost my job|laid off|debt collector|"
    r"gambl\w+|win it (all )?back|get (it|my money) back|make (it|my money) back|\bchase (my )?losses|"
    r"\b(borrow\w*|leverage[ds]?|margin|loan|credit card|remortgag\w+)\b.{0,40}\b(invest\w*|buy\w*|put)\b)",
    re.IGNORECASE)

REFUSE_FUTURE = ("I only use data up to today's simulation date ({sim_date}) and I don't predict "
                 "what markets will do. I can explain what your portfolio holds and why.")
REFUSE_INJECTION = ("I can't change my rules. Holdings come only from our approved ETF list and "
                    "are decided by code, not by chat.")
REFUSE_DISTRESS = ("This sounds stressful. Please consider speaking to a human adviser or a "
                   "support service before making any money decisions.")

_ZERO_WIDTH = re.compile(r"[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\u3164\ufeff\ufe00-\ufe0f]")
_HOMOGLYPHS = {ord(c): d for pairs in (
    "аa еe оo рp сc хx уy іi јj ѕs ԁd ԛq ѵv һh кk мm тt нh вb",
    "Аa Вb Еe Кk Мm Нh Оo Рp Сc Тt Хx",
    "Αa Βb Εe Ζz Ηh Ιi Κk Μm Νn Οo Ρp Τt Υy Χx αa εe ιi κk νv οo ρp τt υu χx") for c, d in pairs.split()}
_LEET_I = str.maketrans("013457@$!|+", "oieastasiit")
_LEET_L = str.maketrans("013457@$!|+", "oleastasilt")
_SPACED = re.compile(r"\b(?:[a-z][ .\-_*,]+){3,}[a-z]\b")
_B64 = re.compile(r"[A-Za-z0-9+/]{16,}={0,2}")


def _clean(text: str) -> str:
    t = unicodedata.normalize("NFKC", text)
    t = _ZERO_WIDTH.sub("", t).translate(_HOMOGLYPHS)
    t = "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn")
    return re.sub(r"[^\S\n]+", " ", t).strip().lower()


def _decoded(text: str) -> list[str]:
    out = []
    for tok in _B64.findall(text):
        try:
            raw = base64.b64decode(tok + "=" * (-len(tok) % 4), validate=True).decode("utf-8")
        except (binascii.Error, UnicodeDecodeError, ValueError):
            continue
        if raw.isprintable():
            out.append(raw)
    return out


def _views(text: str) -> list[str]:
    """base view first: the leet/despaced variants lose digits, so only the base is used for date logic."""
    base = _clean(text)
    despaced = _SPACED.sub(lambda m: re.sub(r"[ .\-_*,]", "", m.group()), base)
    views = {base, despaced, re.sub(r"(.)\1{2,}", r"\1\1", base), re.sub(r"[.\-_*]", "", base)}
    views |= {v.translate(_LEET_I) for v in list(views)} | {v.translate(_LEET_L) for v in list(views)}
    for raw in _decoded(text):
        views.add(_clean(raw))
    return [base, *(views - {base})]


def _lexical(text: str) -> list[str]:
    """Views where only letters carry meaning (reversed / rot13), used for injection only."""
    base = _clean(text)
    return [base[::-1], codecs.encode(base, "rot13"), re.sub(r"(.)\1+", r"\1", base)]


def _future_year(v: str, sim_date: str) -> bool:
    sim_year, sim_month = int(sim_date[:4]), int(sim_date[5:7])
    for m in YEAR.finditer(v):
        year = int(m.group(1) + m.group(2))
        if year > sim_year:
            before = v[max(0, m.start() - 40):m.start()]
            if re.search(GOAL, before) and not re.search(MARKET, v) and not FORWARD.search(v):
                continue
            return True
        if year == sim_year:
            mon = [i + 1 for i, n in enumerate(MONTH_NAMES) if re.search(rf"\b{n[:3]}[a-z]*\.?\s*(of\s+)?$", v[:m.start()])]
            if not mon or mon[0] >= sim_month:
                return True
    return bool(SHORT_YEAR.search(v) or SPOKEN_YEAR.search(v))


def _is_future(v: str, sim_date: str) -> bool:
    return bool(FORWARD.search(v) or POST_EVENTS.search(v) or _future_year(v, sim_date))


def _undated_move(base: str) -> bool:
    return bool(re.search(rf"\b({MOVE})\b", base) and not re.search(PAST, base) and not YEAR.search(base)
                and not EDUCATIONAL.search(base))


def _overrides(v: str) -> bool:
    return any(OVERRIDE.search(c) for c in CLAUSES.split(v) if c and not EXPLAINS.match(c))


def pre_filter(question: str, sim_date: str) -> str | None:
    """Return a refusal string if the question must not reach the LLM, else None."""
    views = _views(question)
    if any(DISTRESS.search(v) for v in views):
        return REFUSE_DISTRESS
    if any(INJECTION.search(v) for v in views + _lexical(question)) or any(_overrides(v) for v in views):
        return REFUSE_INJECTION
    if _undated_move(views[0]) or any(_is_future(v, sim_date) for v in views):
        return REFUSE_FUTURE.format(sim_date=sim_date)
    return None


def fence(user_text: str) -> str:
    """Wrap untrusted user text so the model treats it as data."""
    clean = user_text.replace("<<<", "").replace(">>>", "")
    return f"<<<USER_TEXT\n{clean}\nUSER_TEXT>>>"
