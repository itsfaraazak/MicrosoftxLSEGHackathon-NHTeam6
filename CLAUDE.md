# Don't Double Down — Microsoft x LSEG London Hackathon 2026 (Team 06)

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
7. Feature freeze 14:45. If behind: drop Autopilot at 13:30, drop Ask at 14:30. Core story must survive.

## Stack (versions verified 2026-10-23 from npm/PyPI — re-check before bumping)
- Frontend `frontend/`: Next.js 16.4.2, React 19.3, Tailwind CSS 4.3, shadcn/ui CLI 4.22 (Button, Card, Badge, Tabs,
  Input, Textarea, Sonner, Skeleton, Separator), Recharts 3.10, lucide-react, motion, TanStack Query, zod 4,
  MSAL (Entra ID), Application Insights. Next 16 has breaking changes: read `frontend/node_modules/next/dist/docs/`
  and `frontend/AGENTS.md` before writing Next code.
- Backend `backend/`: Python 3.14, Flask 3.1.3, flask-cors, pydantic 2.14, pandas 3.1, yfinance 1.7, fredapi,
  openai 3.37 (Azure v1 endpoint), azure-cosmos 4.17, azure-identity, azure-monitor-opentelemetry, pytest, ruff.
- Azure: AI Foundry / Azure OpenAI (LLM), Cosmos DB for NoSQL (audit log, profiles), Application Insights.
  Details: `docs/context/AZURE.md`.

## Commands
- Backend: `cd backend && source .venv/bin/activate && flask --app app run --port 5000` (or `python app.py`). `USE_MOCKS=1` serves `backend/mocks/*.json`.
- Frontend: `cd frontend && npm run dev` (port 3000). Set `NEXT_PUBLIC_API_URL` in `.env.local`.
- Tests: `cd backend && python -m pytest -q`. Lint: `ruff check .` / `npm run lint`. Types: `npx tsc --noEmit`.

## Ownership (one person per area, avoid cross-edits)
- Person 1 Frontend: `frontend/**`
- Person 2 Backend core: `backend/app.py`, `backend/engine/**`, `backend/mocks/**`, `backend/data/**`
- Person 3 AI layer + pitch: `backend/ai/**`, slides, Q&A
- Shared contract (change only with all three agreeing, log in `docs/decisions.md`): `docs/api-contract.md`, data model in `docs/context/PROJECT.md`

## Style
Match surrounding code. Python: type hints, pydantic models for shared objects, small pure functions. TS: strict, types
in `lib/api.ts`. No comments that restate code. Prefer editing existing files. Keep the demo path boring and reliable.

## When you finish a chunk of work
Run the relevant checks, then append an entry to `docs/HANDOFF.md` (use `/handoff`). Record any decision in `docs/decisions.md`.
