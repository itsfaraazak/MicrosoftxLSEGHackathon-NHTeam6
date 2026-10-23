# API contract (frontend ↔ backend). JSON in/out. Mocks: backend/mocks/<endpoint>.json. Change only by 3-way agreement.
| Endpoint | Sends | Returns | Owner |
|---|---|---|---|
| POST /api/profile/parse | {text} | {profile, contradictions} | route P2, fn P3 |
| POST /api/portfolio | {profile, sim_date} | {portfolio, explanation, facts} | P2; explanation P3 |
| POST /api/compare | {profiles, sim_date} | {portfolios[]} | P2 |
| GET /api/replay | profile_id, from, to | {months[{date,ours,tech_heavy}], events[GuardEvent+coach_message]} | P2; coach P3 |
| POST /api/ask | {question, profile, sim_date} | {answer, facts_used} | P3 |
| POST /api/agent/step (bonus) | {portfolio, sim_date} | {trades, rule_triggered} | P2 |
| GET /api/health | – | {ok, mocks} | – |
Types: frontend/lib/api.ts. Switch frontend to real backend = NEXT_PUBLIC_API_URL; switch backend off mocks = USE_MOCKS=0.

## Optional fields (additive, safe to ignore)
- `Position.reason: string` (default `""`): one human-readable sentence on why this position is held, e.g. "Treasuries cover your $30,000 house deposit due in 5 years". Present on every position in `/api/portfolio` and `/api/compare`.
- `Portfolio.baseline_overlap_score: number | null` (default `null`): overlap score of a typical tech-heavy / market-cap portfolio for comparison (e.g. 0.52 vs our `overlap_score` 0.31). Same 0..1 scale as `overlap_score`. May be `null`/absent.

## LLM errors and timeouts
`/api/profile/parse`, `/api/ask` and the `explanation` in `/api/portfolio` answer within about 20 s or fail fast with JSON `{"error": string, "fallback": true}`:
- HTTP 504: the model timed out. HTTP 502: the model service failed or is unreachable. Show a friendly message / use the mock or template text; do not retry in a loop.
- HTTP 422 `{"error": string}` (no `fallback`): the profile text could not be parsed into a valid profile.
Server env: `LLM_TIMEOUT_S` (per call, default 12), `LLM_DEADLINE_S` (per request, default 18).
