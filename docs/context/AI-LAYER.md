# AI layer (Owner B) — what exists, how it works, how to run it
Status 2026-10-23 14:15. Verified live against the hackathon portal (gpt-6.1-sol). 234 tests, ruff clean.

## Flow
text → `guardrails.pre_filter` (code, no LLM) → `llm.chat` (portal) → `number_check` (reject numbers not in Facts, retry ×2, then deterministic template) → answer. Every step logged via `db.store.log`.

## Files (backend/ai)
| File | Job |
|---|---|
| `functions.py` | `parse_profile`, `map_exposure`, `explain`, `answer`, `coach` (the 5 functions others call) |
| `guardrails.py` | Refuses look-ahead / injection / distress questions before the model sees them; fences user text; ~195 red-team tests |
| `number_check.py` | Every number/year in LLM text must match a Fact; years after sim date rejected |
| `llm.py` | Portal client: Azure route `/openai/deployments/{model}`, `api-key` header, 12s per call / 18s per request, `LLMTimeout`/`LLMError` |
| `exposure_fallback.py` | Keyword job→sector map if the LLM fails |
Routes: `routes/ai_routes.py` (`/api/profile/parse` 422 on junk, `/api/ask`; 504/502 + `{"error","fallback":true}` on LLM failure). Frontend: `frontend/components/ask-panel.tsx`, `/ask` page.

## Run
```
cd backend && source .venv/bin/activate     # .env needs LLM_BASE_URL, LLM_API_KEY, LLM_MODEL, LLM_API_VERSION (see .env.example)
USE_MOCKS=0 python app.py                    # real AI routes; portfolio/compare/replay stay stubs until A and C land
python scripts/ai_smoke.py                   # live end-to-end check
cd ../frontend && npm run dev                # http://localhost:3000 (/ask is the Ask page)
```
Key: portal → Account → API Details (do not retype from photos: I/l look identical).

## Known limits
Parse takes ~13s. Guardrails are keyword-based (paraphrased future questions and non-English injection can slip through; model + number check are the backstop). `answer` uses mock facts until A's `engine.portfolio.build` exists. Portal content filter blocks `MAI-Thinking-1`.
