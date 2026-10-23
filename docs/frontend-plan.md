# Frontend plan (Person 1) — approved 2026-10-23

Owner: Bipin (P1). Branch: `bipin-frontend`. Scope: `frontend/**` only (plus appends to `docs/HANDOFF.md`, `docs/decisions.md`).
Visual reference: `materials/Don’t Double Down – frontend prototype.html` (look, orbit, clock, coach, chips, copy). Its numeric data is fake: never port numbers.
Exception: the persona "text" paragraphs from its script ARE used (`lib/personas.ts`), with ages prepended and risk sentences appended.
A fresh session should read this file, `CLAUDE.md`, `frontend/AGENTS.md`, then the Progress section below.

## Hard rules
- Frontend only displays. No finance maths. Allowed: formatting, purely visual derivations (slice angle = amount/total), plain display comparisons of two API values.
- Every number comes from an API response and shows provenance (Fact source + as_of) where possible. Buckets/amounts with no Fact get "Portfolio engine · as of {sim_date}".
- Data clock: nothing after the sim cursor is rendered (chart, tooltips, DOM, prefetched values in the UI).
- "Educational hackathon project. Not financial advice. Paper money only." on every view.
- No new npm deps, no WebGL, no MSAL / App Insights wiring, never read `.env`.
- Next 16: `cacheComponents` + `partialPrefetching` are on. `useSearchParams` client tree sits under `<Suspense>` in `app/page.tsx`. Session state is read via `useSyncExternalStore` (server snapshot null) so there is no hydration mismatch.
- shadcn style `base-nova` = Base UI: composition uses `render`, not `asChild`. Read component source before use.

## Resilience
- zod 4 schemas in `lib/schemas.ts`; TS types are `z.infer`.
- **Degrade per section.** Core fields parse strictly (positions, amounts, buckets, months, events). Enhancement fields
  (`overlap_score`, `baseline_overlap_score`, `display_name`, `reason`, `coach_message`) are accepted as unknown by the core schema
  and validated separately with `readEnhancement()`. A bad enhancement hides only that element and shows a small inline contract notice.
- Core mismatch → inline "Contract mismatch" notice naming endpoint + field path; full zod error in console. Never white-screen.
- Numeric strings are coerced; values are never invented. Empty lists may default to `[]`.
- Timeouts: 30 s parse / portfolio / compare / replay / ask (LLM + number-check regeneration); 5 s health; 12 s agent step.
- TanStack Query: one retry (not on contract errors), no refetch on focus/reconnect, `staleTime: Infinity`.
- Health badge polls `/api/health` every 15 s: Live data / Mock data / Backend offline / Offline demo data (warning style).
- Offline fallback: `NEXT_PUBLIC_DEMO_FALLBACK=1` + backend unreachable → `/public/demo/*.json` (filled by `npm run sync-mocks`, which only reads `../backend/mocks`).
- Errors give a next step + Retry: "The backend isn't responding. Check it's running on port 5000, or switch to offline demo data."
- Mock quirks: parse always returns Priya; compare portfolios mapped by index to the profiles sent; replay months are month-start dollars;
  `overlap_score` is a fraction; `reason_facts` are Facts; one `explanation` per portfolio.

## Structure
```
app/layout.tsx, providers.tsx (theme dark default, QueryClient, MotionConfig reducedMotion="user"), page.tsx (Suspense → OrbitApp), globals.css
next.config.ts redirects: /portfolio → /?view=portfolio, /replay → /?view=replay (307)
lib/ schemas.ts api.ts queries.ts app-state.tsx session-store.ts display.ts personas.ts shortcuts.ts flags.ts
components/ orbit dock top-bar sim-clock health-badge provenance-chip fact-chip fact-drawer overlap-rings allocation-donut
            coach-card replay-chart query-state shortcuts-dialog contract-notice
components/views/ profile-view portfolio-view compare-tab replay-view ask-view autopilot-panel(flag NEXT_PUBLIC_AUTOPILOT)
scripts/sync-mocks.mjs
```
App state (context): persona, profile, parse result, portfolio response, sim cursor/date. Profile, persona and portfolio persist in sessionStorage (`ddd:` prefix).
Separate sessionStorage key `ddd:demo-prep` holds background persona parses + compare result; Query keys under `["demo-prep", …]`.

## Views
- **Orbit**: `?view=profile|portfolio|replay|ask`. Active centred; neighbours ±46° rotateY, z −560, dimmed; 4th hidden behind. Spring via `motion/react`;
  reduced motion → crossfade. Dock + prev/next, ←/→, 1–4, swipe, click side panel to front. `inert` on inactive panels' children.
- **Profile**: persona chips fill free text → parse → editable review card → contradictions callout (gold) → "Build my $100,000 plan" → orbit to Portfolio.
- **Portfolio**: overlap rings (overlap_score; baseline only if API sends it), bucket tiles, explanation, donut + holdings with reason_facts chips,
  "How this was decided" drawer, "Compare people" tab.
- **Compare**: NOT on mount. Start once, after the user's first portfolio is built: parse the 3 presets in parallel (deduplicated by persona key),
  then prefetch `/api/compare`. Results stored in sessionStorage `demo-prep` so a refresh doesn't redo LLM calls. Not ready → quiet "Preparing comparison".
  Card header = preset name/job (labelled as input); numbers only from `portfolios[i]`.
- **Replay**: fetch once (profile_id = lowercased first name, from 2022-01-03 to 2023-12-29). X-domain fixed to full requested window (dates aren't a leak);
  values drawn only up to cursor; hatched "Not visible yet" to the right. Y-domain from visible values + padding, expands but never shrinks;
  resets when the cursor returns to the start.
  Prev / Next / Back to 3 Jan 2022 / Play (1.2 s, pauses on events). N/B/R keys. Cursor drives global sim clock.
  Coach card on Guard events (Hold / Rebalance / "I still want to sell" neutral; adviser link; actions only acknowledge). 2023 lag note when tech_heavy > ours in 2023.
- **Ask**: question + profile + sim_date; facts_used chips; "Answer uses data up to <sim_date>"; suggested chips incl. leak test; typing indicator; cancel; text only.
- **Autopilot** (bonus, flagged): `api.agentStep`, trades + rule_triggered, Approve records choice only.
- **Presenter**: `?` shortcuts, P next persona, badge always visible, 1080p no scroll.
  Shift+R "Reset demo" = current session only: profile, portfolio, persona → Priya, cursor → start, view → Profile, Ask history, and their queries.
  It does NOT clear demo-prep, so Compare stays instant. A separate "Clear all caches" action lives in the `?` panel.

## Steps (tsc + lint after each; `npm run build` too at each STOP)
1. Tokens, fonts, providers; schemas, api, queries; health badge.
2. Orbit shell, dock, keyboard, URL sync, redirects. **STOP: commit, update progress, wait for "continue".**
3. Profile view end to end.
4. Portfolio view (rings, buckets, donut, holdings, drawer). **STOP.**
5. Replay view (chart, controls, coach). **STOP.**
6. Compare tab (background parse + prefetch).
7. Ask view (first to cut at 14:30).
8. sync-mocks + offline fallback.
9. Presenter mode, reduced motion, light theme, projector pass.
10. Autopilot (only if time, flagged).
Feature freeze 14:45; after that bug fixes only.

## Progress
- [x] Plan approved; branch `bipin-frontend`; P2/P3 requests posted to HANDOFF.
- [x] Step 1 — tokens + fonts (`globals.css`, `layout.tsx`), providers, `lib/schemas.ts` (core strict + `readEnhancement`), `lib/api.ts`
  (timeouts, ApiError kinds, demo fallback), `lib/queries.ts`, `lib/app-state.tsx` + `lib/session-store.ts`, `lib/display.ts`, `lib/personas.ts`, health badge.
- [x] Step 2 — `components/orbit.tsx` (motion springs, reduced-motion crossfade, swipe, inert, click side to front), `dock.tsx` (tablist),
  `top-bar.tsx`, `sim-clock.tsx`, `orbit-app.tsx` (?view= via history.replaceState, ←/→/1–4), `app/page.tsx` (Suspense), redirects in `next.config.ts`.
  Views are placeholders. tsc + lint + build pass; headless Chromium at 1920×1080 and 390×844: no console errors.
- [ ] Step 3 — Profile view (next).

## Notes for the next session
- macOS: port 5000 is taken by AirPlay Receiver (ControlCenter). Either disable AirPlay Receiver or run Flask on 5001 and set NEXT_PUBLIC_API_URL.
- Smoke-testing without the Flask venv: a read-only Node stub serving backend/mocks on :5001 lives in the session scratchpad (not in the repo).
