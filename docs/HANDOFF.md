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

## 2026-10-23 14:15 · Faraaz · B AI layer (live)
Done: AI layer verified on the real portal over HTTP (parse 13s, ask 7s, leak/injection/distress refused in ms); red-team hardening; empty-profile bug fixed; docs in docs/context/AI-LAYER.md.
Next: switch parse to a faster model if needed; wire A.build + C.coach; mount AskPanel in portfolio page (frontend owner); frontend branch not on GitHub yet.

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

## 2026-10-23 14:42 · P1 (Bipin) · frontend: demo-ready
Done: whole frontend on branch `bipin-frontend` (pushed, not merged). One orbit at `/` with Profile → Portfolio (rings, donut, facts drawer, Compare tab) → Time machine (data-clock chart, coach card, 2023 lag note) → Ask (leak test). Zod-validated API layer, health badge, offline demo fallback (`npm run sync-mocks`, `NEXT_PUBLIC_DEMO_FALLBACK=1`; covers network errors, HTML 5xx and non-JSON), Shift+R reset, ←/→, 1–4, N/B/R. Runbook: `docs/demo-runbook.md`. Backup: `materials/demo-screens/`, `materials/demo-backup.webm`. Plan/progress: `docs/frontend-plan.md`.
Cut: Autopilot, `?` shortcuts panel, P persona cycle, "Clear all caches" button.
Tested: everything against the real Flask app with `USE_MOCKS=1` (port 5001), dev and production build, headless 1920×1080, no console errors. LIVE (`USE_MOCKS=0`, origin/main 617cfea, one probe at 14:35): only `/api/health` works; the rest return HTML 500s (parse: KeyError AZURE_OPENAI_ENDPOINT; portfolio/compare/replay/ask: NotImplementedError). With no CORS headers on those 500s the browser reports a network error, which the fallback handles.
Contract drift / mock quirks (one line each):
1. Replay mock months start 2022-01-01, not 2022-01-03.
2. Compare mock: three identical portfolios, no persona names; frontend maps by index to the personas it sent.
3. Parse mock always returns Priya.
4. Ask mock returns the same sentence for every question, so the leak test cannot be judged on mocks.
5. 500s are HTML (Werkzeug debugger) without CORS headers; please return JSON `{"error": ...}` with CORS.
Open requests for P2/P3 (all optional for the UI; full text in P1's earlier HANDOFF entry): `Position.display_name` and `reason`; define `overlap_score` exactly and add `baseline_overlap_score`; confirm replay `profile_id` (frontend sends lowercased first name); Facts for bucket totals; keyword-based mock parse (nurse→Tom, oil/Aberdeen→Fiona); replay mock starting 2022-01-03; JSON error bodies.
Blockers / heads-up: docs/BACKEND-PLAN.md assigns frontend files to P2/P3 (`app/portfolio/`, `app/replay/`, `app/page.tsx`, "Ask panel", "coach pop-up", "compare screen"). Those routes are gone: everything lives in `frontend/components/**` behind `/`. Please send UI requests here instead of editing `frontend/**`, or we will conflict. The plan also names "the current frontend owner" as owner C for Guard/replay/Cosmos on the backend; I have not started that.
Files touched: frontend/**, docs/frontend-plan.md, docs/demo-runbook.md, docs/decisions.md, docs/HANDOFF.md, materials/frontend-prototype.html, materials/demo-screens/, materials/demo-backup.webm

## 2026-10-23 15:50 · P1 (Bipin) on branch faraaz · mobile + UX fixes, SPARK rename
Done (frontend/** only, nothing committed to main): phone layout rebuilt (slim top bar with menu, one full-height panel, bottom tab bar, no 3D/blur on phones, 24px headings, 44px tap targets); guided tour and swipe navigation removed; "Write your own" persona chip (empty text box, nameless profile sent as "You"); Time machine fixed (a nameless profile left the replay query disabled forever; a 404 now re-registers the plan and retries once; the demo fallback no longer hides that 404); Proof keeps its previous result while reloading, has an error boundary and retry; Ask has one scroll area, a double-submit lock, a visible input above the keyboard and readable backend errors; "Viewing: ..." chip on every view; Compare labels fictional examples and shows your own card for a custom user; new "Where the numbers come from" explainer (menu on phones, chip on desktop); renamed to SPARK; chart sizes itself to its container so axis text is readable on phones.
Tested: headless Chromium, iPhone 13 profile and 1440x900, mock backend (USE_MOCKS=1, port 5070), production build: full flow Write your own -> parse -> build -> Compare -> Time machine to the June 2022 coach card -> menu -> data sources -> Proof -> Ask leak test, no console errors, no horizontal overflow, no future values in the DOM. The real engine (USE_MOCKS=0, no LLM key here) was probed for /api/replay (works for priya) and /api/proof; /api/portfolio needs the LLM key so it was not exercised end to end.
Not done: the production deploy (needs Faraaz's Vercel login). Run `frontend/scripts/deploy-spark.sh` on his machine. Phone GPU smoothness could not be measured in headless Chrome; the known causes (5 stacked 3D panels with 22px backdrop blur, global swipe listeners) are removed, so please try it on a real phone.
Heads-up: the `/ask` route (app/ask, components/ask-panel.tsx) is a separate legacy page, not the Ask tab; untouched. The offline demo data in public/demo still carries the old mock numbers, refresh with `npm run sync-mocks`.
Files touched: frontend/** (orbit, orbit-app, dock, top-bar, sim-clock, panel, who-chip, data-sources-chip, views, replay-chart, lib/{brand,views,personas,display,api,queries,proof}.ts), frontend/scripts/deploy-spark.sh, docs/{DEPLOY,decisions,HANDOFF}.md, CLAUDE.md

## 2026-10-23 16:30 · P1 (Bipin) on branch faraaz · round 3: clarity, live data, architecture
Done: "’s $100,000 plan" fixed (persona texts carry names + fallbacks); senior personas with $100k (frontend + backend/engine/personas.py); pie charts explained (caption, hover centre, Safe/Growth groups, Compare colour key); origin labels on cards; bottom disclaimer removed; Go live opens an explainer before fetching, per-tab effects listed, DataModeChip on every view; Ask answers "do you have recent data?" from code (backend/ai/data_availability.py) and dedupes the repeated job-overlap fact (backend + frontend); /how-it-works page (3 levels, data flow with user boundary, Microsoft/Azure table); docs/ARCHITECTURE.md, DATA-FLOW.md, MICROSOFT-AZURE.md, LIVE-DATA.md.
Tested: tsc, lint, backend pytest (306 pass), production build; headless phone + desktop on mock backend, no console errors. ruff: 2 pre-existing errors in tests/test_portfolio.py (not touched).
Not done: deploy (needs Faraaz's Vercel login: `frontend/scripts/deploy-spark.sh`). Real LLM paths not exercised here (no key). New persona texts are not in the backend prewarm cache, so the first parse of each is slow until `scripts/prewarm.py` is updated/run.
Open: Plan facts are labelled yfinance but are end-2021 static estimates; Compare is not rebuilt after Go live; /api/audit has no auth and no retention limit.
