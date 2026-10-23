# How data moves through SPARK

Accurate to the code on branch `faraaz`, 2026-10-23. Same flows are drawn in the app at `/how-it-works` ("Your data" tab).
Where the code cannot tell us something (for example what the LLM vendor stores), it is said plainly.

## The boundary: where "you" end

```
 YOUR DEVICE (browser)                 |  CROSSES THE INTERNET              | OUR SERVER (a laptop)                 | OUTSIDE US
 - what you type                       |  Vercel proxy -> ngrok tunnel      | rules, caches, audit log              | LLM portal (AI)
 - edits to your profile               |  -> gunicorn :5070                 | reads local market files              | Yahoo Finance (Go live only)
 - sessionStorage "ddd:*" keys         |                                    |                                       |
 - the chart you are looking at        |                                    |                                       |
 never leaves unless you press Read /  |  JSON only: text, profile,         |                                       | public, same for everyone
 Build / Ask                           |  dates, questions                  |                                       |
```

Three kinds of data on screen, never mixed up: **yours** (typed text, your profile), **public market data** (prices, rates, layoffs;
the same for everyone), and **examples** (the three demo people Priya, Tom and Fiona, Compare cards, the saved `public/demo/*.json`
files, and the Proof example portfolio shown when you haven't built a plan).

## Flow 1: build my plan

```mermaid
sequenceDiagram
  autonumber
  participant B as You (browser)
  participant S as SPARK server
  participant L as LLM portal
  participant F as Market files (CSV)
  Note over B: sessionStorage: ddd:persona, ddd:parsed, ddd:profile, ddd:plan
  B->>S: POST /api/profile/parse { text } (free text you typed)
  Note over B,S: YOUR DEVICE ENDS HERE. From this arrow on, data is on the internet.
  S->>S: fence the text as untrusted data
  S->>L: your text + schema instructions (+ system prompt with sim date)
  L-->>S: profile JSON
  S->>S: validate (pydantic), retry up to 2x, code adds contradiction flags
  S->>S: audit log "profile" (the parsed profile)
  S-->>B: { profile, contradictions, meta }
  Note over B: you review and edit. Edits stay in the browser.
  B->>S: POST /api/portfolio { profile, sim_date }
  S->>S: remember profile by first name (memory); cache key = sha256(profile + date)
  S->>L: job title, industry, employer only (fenced)
  L-->>S: sector weights
  S->>S: validate weights in code (allowed sectors, clamp 0..1) else keyword fallback
  S->>S: allocation rules in code build positions and Facts (no prices read here)
  S->>L: positions (ticker, amount, bucket) + Facts list
  L-->>S: explanation text
  S->>S: number check: every number must match a Fact; regenerate up to 2x else template
  S->>S: audit log "explanation"
  S-->>B: { portfolio, explanation, facts, meta }
  Note over B: stored in sessionStorage (ddd:plan)
```

## Flow 2: time machine (replay)

1. Browser -> `GET /api/replay?profile_id=<first name>&from=2022-01-03&to=...` (a first name and dates, no profile body).
2. Server looks the profile up in its in-memory registry (set when you built the plan). Not found -> 404; the app re-sends your profile to
   `/api/portfolio` to register it, then retries once.
3. Server rebuilds the plan from the remembered profile and reads closing prices **through the data clock** (`engine/data_clock.get_prices`),
   clipped at each month. Prices come from `backend/data/prices.csv`.
4. Code (`engine/guard.py`) detects drawdowns, market-wide vs specific, cost of selling. Each event is logged (`guard_event`).
5. Coach message: LLM only if `REPLAY_LLM=1` / `?llm=1`; otherwise `data/coach_cache.json` or a deterministic template. Number-checked either way.
6. Browser receives the whole month series and events up front but **draws only up to the cursor** (the AI never sees prices).

## Flow 3: ask a question

1. Browser -> `POST /api/ask { question, profile, sim_date }`.
2. `guardrails.pre_filter` runs **in code, before the LLM**: distress, prompt injection, look-ahead/future questions are refused
   (logged as `ask_refused`). A refused question never reaches the model.
3. Server rebuilds the Facts for your profile at `sim_date` (same rules as Flow 1; the exposure step may call the LLM with job/industry/employer).
4. LLM receives: your job title and industry, the Facts (id, value, unit, source, as-of date), the fenced question, and a system prompt with the sim date.
   It does **not** receive your name, age, holdings amounts or any raw prices.
5. Number check; fallback sentence if it keeps failing. Audit log `ask` (question + answer).
6. Browser gets `{ answer, facts_used, meta }`; history is kept in sessionStorage (`ddd:ask-history`).

## Flow 4: proof

`POST /api/proof { profile, portfolio, sim_date }` -> **code only, no LLM**. `quant/backtest.py` and `metrics.py` run on prices up to the day before
`sim_date`, verdicts are decided by code, and the response includes the real source of each function, its sha256 and a standalone script.

## Flow 5: go live

`POST /api/live/refresh` -> the server downloads new daily closes for the 17 ETFs from Yahoo Finance (`yfinance`, rate limited to once per 60 s),
writes `prices.csv` atomically and reloads the data clock; `GET /api/live/status` returns the latest date and the browser moves the simulation
clock. No LLM. Every other endpoint still clips at the simulation date.

## Your data: what is kept, where, for how long

| Data | Where | How long | Who can see it |
|---|---|---|---|
| Text you typed, edits before Build | browser memory (React state) | until you leave or press Start over | only you |
| Parsed profile, plan, explanation, facts, persona | browser `sessionStorage`: `ddd:parsed`, `ddd:profile`, `ddd:plan`, `ddd:persona` | until the tab closes or Start over (Shift+R) | only you |
| Ask history | `ddd:ask-history` | same | only you |
| Compare cache (three demo people, not you) | `ddd:demo-prep` | until the tab closes; **kept** by Start over | only you |
| Theme | `localStorage` (next-themes) | until cleared | only you |
| Your profile and plan on the server | in memory: profile REGISTRY (by first name), plan cache | until the server restarts | the server process |
| Audit log | `backend/data/local_store.jsonl` (gitignored), or Cosmos DB if `COSMOS_*` is set | **no expiry or rotation in the code** | anyone with the file; `GET /api/audit` returns recent events with **no authentication** |
| What the audit log contains | kinds: `profile` (the full parsed profile), `exposure`, `explanation`, `ask` and `ask_refused` (question + answer), `guard_event`, `number_check_reject`, coach text | as above | as above |
| What the LLM receives | Flow 1: your free text; job/industry/employer; positions + Facts. Flow 3: job, industry, Facts, question. Coach: event numbers + Facts | per request | the LLM portal operator. **What the portal retains is not visible in our code.** |
| Market data | `prices.csv`, `fred.csv`, `layoffs.csv` | fixed files; prices extended by Go live | public data, same for everyone |
| Request transit | Vercel Edge proxy and the ngrok tunnel | per request | their own logs are outside our code |

## Honest gaps

- The audit log keeps parsed profiles and questions with no retention limit, and `/api/audit` has no login. Fine for a paper-money demo, not for production.
- We cannot see from the code what the LLM portal stores or trains on; ask the organisers before using real personal data.
- The browser receives the whole replay series; only the drawing is limited to the cursor. The guarantee that the **AI and the rules** cannot see the
  future comes from the data clock on the server.
