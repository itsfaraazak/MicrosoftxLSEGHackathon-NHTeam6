# SPARK (Smart Portfolio Advisor for Retail Knowledge, formerly Don't Double Down) — Microsoft x LSEG London Hackathon 2026 (Team 06)

AI investment companion. Client: everyday retail investor with $100k. Builds a portfolio around their whole life
(job exposure, goals, holdings) so savings don't bet on the same thing as the paycheck. Demo = "time machine"
replaying the 2022 tech crash from 2022-01-03 with paper money. **Educational hackathon project. Not financial advice.**

Read first, every session: `docs/context/PROJECT.md`, `docs/HANDOFF.md` (latest entries), `docs/decisions.md`.
Full original plan: `materials/Hackathon build plan Don't Double Down.pdf`. Judging: `docs/context/RUBRIC.md`.

## Hard rules (never break)
1. **Code decides, LLM explains.** The LLM never picks holdings, never predicts, never sees raw data. It gets a small
   `facts` object built by code.
2. **Data clock.** All prices go through `backend/engine/data_clock.get_prices(tickers, as_of)`. Never read CSVs
   directly. Plain `Close`, never `Adj Close`. ETFs that existed before 2022 only.
3. **Number check.** Every number in LLM text must exist in the Fact list (`backend/ai/number_check.py`). Reject + regenerate.
4. **Frontend only displays.** Only Flask touches data, LLM, DB. Frontend ↔ backend meet only at `docs/api-contract.md`.
5. **No secrets in git.** Keys live in `backend/.env` / `frontend/.env.local` (gitignored). Never paste keys, credential
   sheets or screenshots of them into code, docs, commits or chat with Claude. Never read `.env` files.
6. **Audit everything.** Inputs, outputs, trades go through `backend/db/store.log()`.
7. Core story must always survive: profile -> portfolio that avoids your job's risk -> 2022 replay -> proof. If time is short, cut features, never the demo path.
8. LLM endpoints answer within ~20 s or return `{"error","fallback":true}` (504/502), never hang. Keep field names/types exactly as in `backend/mocks/*.json`.

## Stack (versions verified 2026-10-23 from npm/PyPI — re-check before bumping)
- Frontend `frontend/`: Next.js 16.4.2, React 19.3, Tailwind CSS 4.3, shadcn/ui CLI 4.22 (Button, Card, Badge, Tabs,
  Input, Textarea, Sonner, Skeleton, Separator), Recharts 3.10, lucide-react, motion, TanStack Query, zod 4,
  MSAL (Entra ID), Application Insights. Next 16 has breaking changes: read `frontend/node_modules/next/dist/docs/`
  and `frontend/AGENTS.md` before writing Next code.
- Backend `backend/`: Python 3.14, Flask 3.1.3, flask-cors, pydantic 2.14, pandas 3.1, yfinance 1.7, fredapi,
  openai 3.37 (Azure v1 endpoint), azure-cosmos 4.17, azure-identity, azure-monitor-opentelemetry, pytest, ruff.
- LLM: the organisers' OpenAI-compatible portal (Azure-hosted models). Cosmos DB/App Insights are optional and only claimed if wired. Free-tier notes: `docs/context/AZURE.md`.

## Quick start (copy-paste; from repo root)
```bash
# one-time
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && cd ..
cd frontend && npm install && cd ..
cp backend/.env.example backend/.env          # then fill the LLM vars (see Environment). NEVER commit .env
backend/.venv/bin/python backend/scripts/download_prices.py   # only if backend/data/prices.csv is missing (yfinance, ~1 min)

# every session (3 terminals, or background them)
cd backend && USE_MOCKS=0 .venv/bin/gunicorn -w 1 --threads 8 --timeout 60 -b 0.0.0.0:5070 -b '[::]:5070' app:app   # real backend
cd frontend && NEXT_PUBLIC_API_URL=http://localhost:5070 npm run dev -- -p 3000                                    # http://localhost:3000
cd backend && .venv/bin/python scripts/prewarm.py                                                                    # warm persona caches so demo clicks are instant
```
Mock-only mode (no LLM/keys needed): `cd backend && USE_MOCKS=1 .venv/bin/python app.py` (set `FLASK_PORT=5070`). Frontend can also run fully offline: `NEXT_PUBLIC_DEMO_FALLBACK=1` + `npm run sync-mocks`.
Smoke tests: `cd backend && .venv/bin/python scripts/ai_smoke.py` (live model: parse, exposure, ask, leak, injection) · `curl localhost:5070/api/health` -> `{"mocks":false,"ok":true}`.

## Checks (run before every commit)
`cd backend && .venv/bin/python -m pytest -q && .venv/bin/ruff check .` · `cd frontend && npx tsc --noEmit && npm run lint && npm run build`

## Ports and gotchas (all learned the hard way on 2026-10-23)
- **Backend = port 5070.** Not 5000 (macOS AirPlay Receiver owns it). **Never 5060/5061**: Chrome blocks them (`ERR_UNSAFE_PORT`) so the browser says "Failed to fetch"/"Backend offline" while curl works fine.
- CORS allows `localhost`/`127.0.0.1` on 3000, 3001, 3055 only (`backend/app.py`). Add a port there if you use another.
- gunicorn has **no hot reload**: restart it after any backend/.env change (`pkill -f 'gunicorn.*5070'`, then start again). Use `-w 1 --threads 8` so the in-memory portfolio cache is shared (2 workers = two separate caches).
- `NEXT_PUBLIC_*` vars are baked at build/dev start: restart `npm run dev` after changing `NEXT_PUBLIC_API_URL`.
- Tests that monkeypatch `ai.llm.chat` never hit the network; `scripts/ai_smoke.py` does.
- `backend/data/*.csv` and `.env` are gitignored: each teammate regenerates data with `scripts/download_*.py` and gets keys from the portal.
- The repo is PUBLIC on GitHub. Nothing secret in any commit, doc, screenshot or prompt.

## Environment (names only; values live in `backend/.env`, gitignored)
`USE_MOCKS` (1 = serve `backend/mocks/*.json`, 0 = compute) · `FLASK_PORT` · `RATE_LIMIT_PER_MIN` (60 on LLM routes)
LLM (hackathon portal, Azure-style route `/openai/deployments/{model}` + `api-key` header): `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_API_VERSION` (e.g. 2024-10-21), `LLM_MODEL`, `LLM_FAST_MODEL` (JSON extraction calls), `LLM_TIMEOUT_S` (12), `LLM_DEADLINE_S` (18), `LLM_MAX_TOKENS`.
Models on the portal: `gpt-5.6-terra` (fastest, best for us: ~2-4 s, no reasoning tokens), `gpt-6-luna`, `gpt-6.1-sol` (slow, 5-12 s), `gpt-6-astra`, `MAI-Thinking-1` (blocked by the portal's content filter). Reasoning models need `max_completion_tokens` and reject custom `temperature`: already handled in `backend/ai/llm.py`.
Key tip: copy the API key from the portal (Account -> API Details). Do not retype it from photos: capital `I` and lowercase `l` look identical.
Optional: `COSMOS_ENDPOINT`/`COSMOS_KEY` (audit log; falls back to `backend/data/local_store.jsonl`), `FRED_API_KEY` (not needed: FRED public CSV is used).

## Deploy for judges' phones (details: `docs/DEPLOY.md`)
Frontend on Vercel (stable URL, `frontend/vercel.json` proxies `/api/*` to the laptop), backend on this laptop through an ngrok tunnel to port 5070 (stable domain; `ngrok http 5070`). Phones see one origin. Redeploy: `frontend/scripts/deploy.sh`. Keep the laptop awake (`caffeinate -dimsu`), prewarm before the demo, kill the tunnel (`pkill ngrok`) after judging. Offline demo fallback (`NEXT_PUBLIC_DEMO_FALLBACK=1`) keeps the app usable if the tunnel drops.

## What is built (all verified; spec/gap table in `docs/SPEC.md`)
- **Endpoints** (shapes in `docs/api-contract.md`, mocks in `backend/mocks/`): `POST /api/profile/parse`, `/api/portfolio`, `/api/compare`, `/api/ask`, `/api/proof`, `/api/agent/step`; `GET /api/replay`, `/api/proof/script`, `/api/audit`, `/api/rigor/summary`, `/api/health`; live market: `/api/live/status|quotes|refresh`, `/api/data/sources` (when `routes/live_routes.py` exists).
- **AI layer** (`backend/ai/`): `guardrails.py` (look-ahead/injection/distress refused in code before the LLM), `number_check.py` (every number must match a Fact), `functions.py` (parse_profile, map_exposure, explain, answer, coach), `llm.py` (portal client, timeouts, fast model), `rigor.py` (collects per-request trace -> `meta` on responses).
- **Engine** (`backend/engine/`): `data_clock` (only door to prices), `exposure` (job -> sector overlap), `portfolio` (allocation rules 1-6 + advisory flags), `guard` (drawdown events, replay), `agent` (Autopilot: whitelist, caps, kill switch, approval), `personas` (Priya/Tom/Fiona).
- **Quant proof** (`backend/quant/`): backtest + verdicts decided by code, ships the real source of each function, a sha256 and a reproducible script. Honest "not supported" verdicts are shown.
- **Frontend** (`frontend/`): single-page orbit app (Bipin) with profile, portfolio, compare, time machine, Ask, Proof views; rigor drawer, live-data button, data-sources explainer, "Write your own" profile. The guided tour and swipe-to-change-view were removed (they ate the screen); phones get a bottom tab bar and one full-height panel.
- **Tests:** ~280 backend tests incl. ~195 red-team cases. Data clock leak test, number-check tests, 2022 results must not change when data is extended.

## Branches
`main` (shared), `faraaz` (Faraaz: AI layer + integration), `backend-prince` (Prince: portfolio engine, merged to main), `bipin-frontend` (Bipin: frontend; never edit it from other branches, merge it INTO yours: `git fetch && git merge origin/bipin-frontend`). Commit with the Co-Authored-By line; never force-push; never push secrets.

## Ownership (slices from `docs/BACKEND-PLAN.md`; start a session with `/start-slice A|B|C`)
- A Portfolio Engine (Prince): `backend/engine/{data_clock,exposure,portfolio}.py`, `backend/data/**`, `routes/portfolio_routes.py`
- B AI Layer + pitch (Faraaz): `backend/ai/**`, `routes/{ai,audit}_routes.py`, `docs/pitch/**`
- C Time Machine: `backend/engine/{guard,agent}.py`, `backend/db/**`, `routes/timemachine_routes.py`
- Frontend (Bipin): `frontend/**` (additive edits only from others)
- Shared contract (change only with all agreeing, log in `docs/decisions.md`, update the mock in the same commit): `backend/models.py`, `docs/api-contract.md`, `backend/mocks/**`


## Status as of 2026-10-23 ~15:00 (read this first)
- **Public demo:** https://dont-double-down-t6.vercel.app (Vercel frontend; `frontend/middleware.ts` proxies `/api/*` to this laptop's backend through ngrok `https://superbowl-jalapeno-mower.ngrok-free.dev` -> port 5070). If the laptop/tunnel is down the site falls back to demo data. Redeploy (needs Faraaz's Vercel login): `frontend/scripts/deploy-spark.sh`. Runbook: `docs/DEPLOY.md`, `docs/demo-runbook.md`.
- **Time machine** replays a client by first name: `/api/portfolio` registers the profile (`engine/personas.remember`), `/api/replay?profile_id=<first name>` finds it. Unknown name -> 404 "build a plan first".
- **Data:** `docs/pitch/SLIDE-ANSWERS.md` (every slide question answered, data-source table, known weaknesses), `backend/data/SOURCES.md`, `docs/SPEC.md` (PDF spec vs code: met/partial/missing).
- **Known issues:** phone layout clipping and a reported phone freeze were being fixed (check `git log`/`docs/HANDOFF.md`; fixed 2026-10-23 (tour removed, phone layout rebuilt)); Proof tab overlap row uses the example mock portfolio (real engine gives Priya 5.4% vs 21.5%); Fiona's overlap is above the baseline; sector weights are end-2021 approximations; Cosmos DB / App Insights are NOT wired, do not claim them.
- **Before judging:** `caffeinate -dimsu`; start backend (1 worker) + `ngrok http 5070`; run `backend/scripts/prewarm.py`; test the public URL on a phone.

## Style
Match surrounding code. Python: type hints, pydantic models for shared objects, small pure functions. TS: strict, types
in `lib/api.ts`. No comments that restate code. Prefer editing existing files. Keep the demo path boring and reliable.

## When you finish a chunk of work
Run the relevant checks, then append an entry to `docs/HANDOFF.md` (use `/handoff`). Record any decision in `docs/decisions.md`.
