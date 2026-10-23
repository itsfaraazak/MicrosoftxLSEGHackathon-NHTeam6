# Don't Double Down
Microsoft x LSEG London Hackathon 2026, Team 06. An AI analyst that builds a $100,000 portfolio around the client's whole life (job, goals, holdings) so savings do not bet on the same thing as the paycheck, explains every holding with sourced numbers, proves the strategy with code, and replays the 2022 tech crash as a paper-money time machine. Educational project, not financial advice.

**Live demo:** https://dont-double-down-t6.vercel.app (needs the team laptop backend running; offline fallback otherwise)

## How it works
Code decides, the LLM only interprets and explains. A data clock stops any price after the simulation date (3 Jan 2022) from being read. Every number in LLM text is checked against computed facts. Guardrails refuse future-looking, injection and distress prompts before the model is called. Proof tab shows the real code and a reproducible script behind each claim.

## Run it (details and gotchas in CLAUDE.md)
```bash
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # then copy .env.example to .env and fill LLM vars
USE_MOCKS=0 .venv/bin/gunicorn -w 1 --threads 8 -b 0.0.0.0:5070 app:app            # backend on 5070 (never 5000/5060)
cd frontend && npm install && NEXT_PUBLIC_API_URL=http://localhost:5070 npm run dev -- -p 3000
cd backend && .venv/bin/python scripts/prewarm.py                                   # warm demo caches
```
Tests: `cd backend && .venv/bin/python -m pytest -q` (284) | `cd frontend && npx tsc --noEmit && npm run lint && npm run build`

## Docs
`CLAUDE.md` (rules, commands, status) | `docs/SPEC.md` | `docs/pitch/SLIDE-ANSWERS.md` | `docs/DEPLOY.md` | `docs/api-contract.md` | `backend/data/SOURCES.md`

## Data
yfinance prices (17 ETFs, 2015 to Oct 2026), FRED CPI and 3-month Treasury, layoffs.fyi tracker mirror, approximate end-2021 ETF sector weights. LLM: the organisers' OpenAI portal.
