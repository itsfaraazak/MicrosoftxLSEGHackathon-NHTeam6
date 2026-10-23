# API contract (frontend ↔ backend). JSON in/out. Mocks: backend/mocks/<endpoint>.json. Change only by 3-way agreement.
| Endpoint | Sends | Returns | Owner |
|---|---|---|---|
| POST /api/profile/parse | {text} | {profile, contradictions} | route P2, fn P3 |
| POST /api/portfolio | {profile, sim_date} | {portfolio, explanation, facts} | P2; explanation P3 |
| POST /api/compare | {profiles, sim_date} | {portfolios[]} | P2 |
| GET /api/replay | profile_id, from, to | {months[{date,ours,tech_heavy}], events[GuardEvent+coach_message]} | P2; coach P3 |
| POST /api/ask | {question, profile, sim_date} | {answer, facts_used} | P3 |
| POST /api/agent/step (bonus) | {portfolio, sim_date} | {trades[AgentAction + reason], rule_triggered, kill_switch, slice_usd, log_id} | P2 |
| GET /api/health | – | {ok, mocks} | – |
| GET /api/audit | ?limit=&kind= | {events:[{id,kind,ts,summary,payload}]} | P3 |
| GET /api/rigor/summary | – | {principles[], tests:{backend,redteam_cases}, guarded_by[]} | P3 |
Types: frontend/lib/api.ts. Switch frontend to real backend = NEXT_PUBLIC_API_URL; switch backend off mocks = USE_MOCKS=0.

## Optional fields (additive, safe to ignore)
- `Position.reason: string` (default `""`): one human-readable sentence on why this position is held, e.g. "Treasuries cover your $30,000 house deposit due in 5 years". Present on every position in `/api/portfolio` and `/api/compare`.
- `Portfolio.baseline_overlap_score: number | null` (default `null`): overlap score of a typical tech-heavy / market-cap portfolio for comparison (e.g. 0.52 vs our `overlap_score` 0.31). Same 0..1 scale as `overlap_score`. May be `null`/absent.
- `Portfolio.flags: string[]` (default `[]`): plain-English advisory notes computed in code (not the LLM) that don't change the fixed $100k allocation: emergency fund below 3 months, high-interest debt (pay off first), employer-stock holding above 10% of assets, a growth position above the 25% single-ETF cap, and a UK-client/USD-ETF currency-risk note. Empty/absent is safe to ignore. Present on every position-bearing portfolio in `/api/portfolio` and each entry of `/api/compare`.
- `meta: object | null` (optional, additive, safe to ignore) on `/api/ask` and `/api/profile/parse` — "show the rigor" trace for that one LLM-backed call. Shape (see `backend/mocks/ask.json` / `backend/mocks/profile_parse.json` for worked examples):
  `{model: string, latency_ms: int, llm_calls: int, guardrail: null | "future_question" | "prompt_injection" | "distress" | "other", number_check: {numbers_checked: int, rejected: string[], retries: int, fallback_used: bool}, data_as_of: string | null, steps: [{name: string, kind: "code" | "llm", ms: int, result: string}]}`.
  `guardrail` is non-null only when the question was refused before reaching the model (then `llm_calls` is 0 and `steps` has just the guardrail step). Collected server-side via the `ai.rigor` contextvar collector (see below) and attached by the route, not by `ai/functions.py` itself — existing function signatures/returns are unchanged.

### `ai.rigor` helper (backend/ai/rigor.py) — for other routes to attach the same `meta`
Any route that calls into `ai/functions.py` (e.g. `routes/portfolio_routes.py` calling `explain()`) can get the same rigor trace:
```python
from ai import rigor
with rigor.collect():
    text = functions.explain(portfolio, facts)
    meta = rigor.meta()          # read INSIDE the `with` block
jsonify({..., "meta": meta})
```
`rigor.meta()` returns `None` if no `collect()` block is open (e.g. plain unit tests calling `ai.functions` directly keep working unchanged). Inside instrumented code, the setters `rigor.set_model`, `rigor.set_data_as_of`, `rigor.set_guardrail`, `rigor.note_llm_call`, `rigor.note_number_check(checked, rejected)`, `rigor.note_retry`, `rigor.note_fallback_used` and `rigor.step(name, kind, ms, result)` are all no-ops outside a `collect()` block.

## GET /api/audit  (owner P3 — surfaces the audit trail `db.store.log` already writes)
`?limit=` (default 50, max 500) `&kind=` (comma-separated kind filter, e.g. `kind=ask,ask_refused`). Returns `{"events": [{id, kind, ts, summary, payload}]}`, newest first. `summary` is a one-line human sentence derived per `kind` (e.g. `"Asked: Why do I have so little in tech? -> answered, 2 numbers checked, 0 rejected"`, `"Refused before the model: future-looking question (...)"`, `"Number check rejected \"41\" and regenerated"`). `payload` is the raw logged event — nothing is redacted (no secrets are ever logged). Backed by `backend/mocks/audit.json` under `USE_MOCKS=1`; for real reads, `db.store.recent(limit, kinds)` reads Cosmos if configured, else the local JSONL store, and never raises (returns `[]` on any error).

## GET /api/rigor/summary  (owner P3 — static "why trust this" panel for judges)
No body. Returns `{"principles": [{id, title, detail}], "tests": {"backend": int, "redteam_cases": int}, "guarded_by": [string]}`. `tests` is computed by a cheap static grep of `backend/tests/*.py` (cached 5 min), not a live pytest run. Not mocked (cheap, no LLM) — always computed.

## LLM errors and timeouts
`/api/profile/parse`, `/api/ask` and the `explanation` in `/api/portfolio` answer within about 20 s or fail fast with JSON `{"error": string, "fallback": true}`:
- HTTP 504: the model timed out. HTTP 502: the model service failed or is unreachable. Show a friendly message / use the mock or template text; do not retry in a loop.
- HTTP 422 `{"error": string}` (no `fallback`): the profile text could not be parsed into a valid profile.
Server env: `LLM_TIMEOUT_S` (per call, default 12), `LLM_DEADLINE_S` (per request, default 18).

## POST /api/proof  (owner B; "quant dev in a box" — every claim backed by code + numbers)
Sends `{profile, portfolio?, sim_date}` (portfolio optional). Returns the shape in `backend/mocks/proof.json`:
`strategy`/`baseline` weights, `metrics[]` (cagr, volatility, max_drawdown, sharpe, overlap; `strategy`,`baseline` as fractions, `better` bool),
`stress[]` (named past sell-offs), `claims[]` (`verdict`: supported | not_supported | inconclusive; `evidence`; `code_id`),
`code[]` (exact source of the functions that ran, `sha256`, `output`), `facts[]` (Fact objects, so the number check covers the proof),
`caveats[]`, `script` (standalone reproducible script). Backtest window ends at the day before `sim_date` (data clock). Not-supported verdicts are shown honestly.
Errors: 422 bad input; 504/502 not applicable (no LLM in the compute path).

## Live data (owner: data agent; routes in backend/routes/live_routes.py)
All live endpoints respect the simulation data clock: they report on data *as downloaded* (real wall-clock trading days), but every other endpoint (`/api/portfolio`, `/api/proof`, `/api/replay`, ...) still computes using `as_of = sim_date` and never looks past it — extending `prices.csv` must not change any already-computed historical result (see `backend/tests/test_live.py`).

### GET /api/live/status
No body. Returns the shape in `backend/mocks/live_status.json`:
`{latest_date, first_date, rows, tickers, source, stale_days, live_enabled}` — `latest_date`/`first_date` are the last/first dates actually in `prices.csv`, `rows`/`tickers` are counts, `stale_days` = (today - latest_date) in days, `live_enabled` is a static feature flag for whether `/api/live/refresh` is wired up on this deployment (the 60s cooldown on refresh itself is reported only by that endpoint's own errors, not here).

### GET /api/live/quotes
No body. Returns the shape in `backend/mocks/live_quotes.json`:
`{as_of, fetched_at, source, quotes[{ticker, name, close, prev_close, change_pct}], rates:{tb3ms, cpi_yoy}}` for all 17 tickers. Cached server-side for 5 minutes; on upstream failure, serves the last-good cached payload (same shape) rather than erroring, unless there is no cache yet.

### POST /api/live/refresh
No body (or `{}`). Downloads new daily closes (yfinance, `auto_adjust=False`) from the day after the last row in `prices.csv` through today and appends them atomically (temp file + rename; never corrupts existing data on failure). Rate-limited to once per 60s per process. Returns `{"ok": true, "as_of": "2026-10-22", "rows_added": 450, "previous_latest": "2024-12-31"}` on success.
Errors: on upstream failure (rate limited / unreachable) or when called again inside the 60s cooldown, returns HTTP 429 or 502 with JSON `{"error": string, "fallback": true}` and makes no changes to `prices.csv`.

### GET /api/data/sources
No body. Returns the shape in `backend/mocks/data_sources.json`: a list of `{id, label, provider, file, rows, from, to, fetched_at, kind}` built by scanning files on disk under `backend/data/` (and `backend/mocks/`); `kind` is one of `real` (downloaded from a live provider), `curated` (hand-assembled from public sources, cited), or `mock` (fixture, not real data — everything under `backend/mocks/` counts as `mock`). See `backend/data/SOURCES.md` for the authoritative per-file provenance this endpoint reflects.
