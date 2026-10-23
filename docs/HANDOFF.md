# Handoff log — append newest at the BOTTOM. Every Claude session ends with one entry (use /handoff).
Format: `## YYYY-MM-DD HH:MM · <person> · <area>` then Done / In progress / Next / Blockers / Files touched.

## 2026-10-23 · scaffold · all
Done: Next.js 16 + Tailwind 4 + shadcn frontend (3 screens on mocks); Flask backend with mocks for every endpoint, data clock, number check, LLM + Cosmos wrappers, tests.
Next: P2 download data to backend/data/*.csv + real engine; P3 wire ai/functions to Azure; P1 polish screens, persona compare, Ask panel.
Blockers: Azure endpoint/deployment/Cosmos values not yet in backend/.env.

## 2026-10-23 13:49 · scaffold · all
Done: split backend routes into per-owner blueprints; added backend/models.py (shared pydantic contract) and docs/BACKEND-PLAN.md; /start-slice command.
Owners (fill in names): A Portfolio Engine = Prince (Kongara Prince Vijay Santhosh) · B AI Layer + pitch = Faraaz · C Time Machine = ____ (current frontend owner; fill in)
Requests (owner → owner): (none yet)

## 2026-10-23 13:58 · Faraaz · B AI layer
Done: ai/functions.py (parse_profile, map_exposure, explain, answer, coach), guardrails (look-ahead/injection/distress refused in code before LLM), number check v2 (future years, k/m suffix), keyword exposure fallback, 28 tests, scripts/ai_smoke.py, docs/plans/B-AI-LAYER.md, docs/pitch/PITCH.md.
In progress: none. Next: live Azure smoke test, AI-security coach review, wire A.build/C.coach at 14:30, Ask panel UI.
Blockers: Azure endpoint + deployment name + key meaning.
Requests: A (Prince) — export `engine.portfolio.build(profile, exposure, sim_date) -> (Portfolio, list[Fact])`; I call `ai.functions.map_exposure(profile)` for the ExposureMap. C — call `ai.functions.coach(event, facts)` per GuardEvent.
