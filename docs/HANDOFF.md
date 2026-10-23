# Handoff log — append newest at the BOTTOM. Every Claude session ends with one entry (use /handoff).
Format: `## YYYY-MM-DD HH:MM · <person> · <area>` then Done / In progress / Next / Blockers / Files touched.

## 2026-10-23 · scaffold · all
Done: Next.js 16 + Tailwind 4 + shadcn frontend (3 screens on mocks); Flask backend with mocks for every endpoint, data clock, number check, LLM + Cosmos wrappers, tests.
Next: P2 download data to backend/data/*.csv + real engine; P3 wire ai/functions to Azure; P1 polish screens, persona compare, Ask panel.
Blockers: Azure endpoint/deployment/Cosmos values not yet in backend/.env.

## 2026-10-23 · P1 (Bipin) · frontend plan + requests
Done: Plan approved and saved to `docs/frontend-plan.md`. Branch `bipin-frontend`. Frontend validates every response with zod; unknown/missing optional fields degrade per section.
In progress: Step 1 (theme, fonts, API layer, health badge).
Requests for P2/P3 (all optional on the frontend side; UI works without them):
1. P2 · `Position.display_name` (e.g. "Short-term US Treasuries") and `Position.reason` (one plain sentence) per holding.
2. P2 · Define exactly what `overlap_score` measures (fraction 0–1 of what?) and add `Portfolio.baseline_overlap_score` for a typical portfolio so the rings can animate from baseline to ours.
3. P2 · Replay `profile_id` convention. Frontend sends the lowercased first name (`priya`, `tom`, `fiona`). Confirm or tell me what to send.
4. P2 · Mock replay should start at 2022-01-03 to match the pitch (currently 2022-01-01).
5. P2/P3 · Mock `/api/profile/parse` returns Priya for every input. Could it pick the persona by keyword (nurse → Tom, oil/Aberdeen → Fiona) so Compare looks right on mocks?
6. P2 · Facts for bucket totals (`safe_bucket_usd`, `growth_bucket_usd`) so they can carry provenance like positions do.
7. P2/P3 · Return JSON error bodies (`{"error": "..."}` with a status), not HTML 500s / NotImplementedError pages.
Files touched: docs/frontend-plan.md, docs/decisions.md, docs/HANDOFF.md

## 2026-10-23 · P1 (Bipin) · Mac port note
On Macs, port 5000 clashes with AirPlay Receiver. Turn it off in System Settings → General → AirDrop & Handoff, or run Flask with FLASK_PORT=5001 and set NEXT_PUBLIC_API_URL to match.
