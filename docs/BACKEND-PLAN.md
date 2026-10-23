# Backend work split — 3 owners, full features, built with Claude Code on each PC
Written 13:49. Freeze **14:45**. Integration checkpoint **14:30**. Ready **15:30**. (13:30 checkpoint passed: cut Autopilot unless C is ahead.)
Owners: **A = Prince**, **B = Faraaz**, **C = the current frontend owner** (becomes C once the frontend shell is done; name in `docs/HANDOFF.md`).

## Principle: vertical slices, one owner per feature, end to end
Each owner owns a feature's backend module + its route file + its frontend screen + its tests + its mock. Nobody waits: every
cross-owner call has a fixed Python signature and a stub that returns mock data, so everything runs from minute 0.

| | Feature | Backend files (only you edit) | Route file | Frontend (only you edit) | Plan modules |
|---|---|---|---|---|---|
| **A** | **Portfolio Engine**: data → exposure → allocation → compare | `engine/data_clock.py` `exposure.py` `portfolio.py`, `data/` | `routes/portfolio_routes.py` | `app/portfolio/`, compare screen | 2 (code half), 3 |
| **B** | **AI Layer**: parse, explain + number check, Ask, safety, Azure OpenAI, pitch | `ai/**` | `routes/ai_routes.py` | `app/page.tsx` (input), Ask panel | 1, 2 (LLM half), 4, 5 |
| **C** | **Time Machine**: Guard, replay, coach pop-up, audit log, (bonus Autopilot), demo driving | `engine/guard.py` `agent.py`, `db/store.py` | `routes/timemachine_routes.py` | `app/replay/`, coach pop-up | 6, 7 + Cosmos |
Shared (touch only by 3-way agreement, log in `docs/decisions.md`): `models.py`, `docs/api-contract.md`, `mocks/`, `CLAUDE.md`.

## Interfaces (stable signatures — build against stubs, swap in real)
```python
# A exports
engine.data_clock.get_prices(tickers: list[str], as_of: str) -> DataFrame      # exists; only door to prices
engine.exposure.overlap(exposure: ExposureMap, etf_sector_weights) -> float
engine.portfolio.build(profile: Profile, exposure: ExposureMap, sim_date: str) -> tuple[Portfolio, list[Fact]]
# B exports (all take/return models.py objects; never see raw data)
ai.functions.parse_profile(text: str) -> dict                   # {profile, contradictions}
ai.functions.map_exposure(profile: Profile) -> ExposureMap      # LLM maps job/employer -> sectors
ai.functions.explain(portfolio: Portfolio, facts: list[Fact]) -> str     # number-checked
ai.functions.answer(question: str, profile: Profile, sim_date: str) -> dict   # {answer, facts_used}
ai.functions.coach(event: GuardEvent, facts: list[Fact]) -> str
# C exports
engine.guard.detect(portfolio: Portfolio, sim_date: str) -> list[GuardEvent]
engine.guard.replay(profile: Profile, start: str, end: str) -> dict       # {months, events}; calls A.build, B.coach
db.store.log(kind: str, payload: dict) -> dict                  # everyone calls this on every input/output
```
Until a dependency lands, call it behind `try/except NotImplementedError` or read `mocks/*.json`. `USE_MOCKS=1` keeps the demo alive.

## Timeline (all three in parallel)
| Time | A Portfolio Engine | B AI Layer | C Time Machine |
|---|---|---|---|
| 13:50–14:05 | Download prices/FRED to CSV (yfinance **Close**, 2015–2024, ETF universe); sector map; `portfolio.build` rules 1–6 | `llm.py` on Azure (needs endpoint/key/deployment from coach); `parse_profile`; `map_exposure` | `guard.detect` (drawdown, market-wide vs specific, cost of selling, recovery history from pre-sim data); `db/store.py` on Cosmos; replay UI against mock |
| 14:05–14:30 | `/api/portfolio` real; `/api/compare` for 3 personas; portfolio+compare screens | `explain` + number check wired and tested; `answer` | `replay()` end to end 2022-01..2023-12 using A.build; `coach` pop-up; call B.coach |
| **14:30** | **Checkpoint 2:** 3 personas + replay + one coach message work on real backend (`USE_MOCKS=0`) | | |
| 14:30–14:45 | Bug fixes, LSEG coach reviews rules | Leak test + prompt-injection test (`/leak-test`); Ask panel | Bonus Autopilot only if all green; record backup video at 14:45 |
| **14:45** | **FREEZE.** Only bugfixes + rehearsal | Slides, Q&A sheet, 2 timed rehearsals | Drive the laptop; backup video saved |
Cut rule: behind at 14:30 → drop Ask, keep coach. Core story: profile → portfolio avoiding job risk → 2022 replay.

## Agentic workflow for each owner (on your own PC)
1. `git pull`, `git switch -c <a|b|c>/<feature>` (or `git worktree add ../dd-<x> -b <x>/<feature>` for parallel Claude sessions).
2. Run `/start-slice A` (or B, C). Claude reads CLAUDE.md + context + this plan and states your task list, interfaces and tests.
3. Tell Claude: "plan first, then implement the first item with a pytest test". Keep prompts to one module at a time.
4. After each module: `/check`, commit, push your branch, merge to `main` quickly (small PRs; you own your files so conflicts are rare).
5. Before you stop or switch task: `/handoff`. Before you start: `git pull` + `/sync`.
6. Never edit another owner's files. Need a change from them? Add a line under "Requests" in `docs/HANDOFF.md`, or change the contract with everyone's OK.

## Kickoff prompts (paste after `/start-slice`)
**A:** "Implement backend/engine per BACKEND-PLAN owner A. Write `scripts/download_data.py` (yfinance Close 2015-01-01..2024-12-31 for the PROJECT.md ETF universe → data/prices.csv; FRED CPIAUCSL,TB3MS → data/fred.csv). Then exposure.py, then portfolio.build implementing allocation rules 1–6 as pure functions with pytest tests, every position carrying Fact objects. Use only get_prices."
**B:** "Implement backend/ai per owner B. Wire llm.py to Azure (env vars only, never read .env). parse_profile → Profile with contradictions; map_exposure; explain with number_check retry; answer from supplied facts only; add tests: number check, look-ahead leak ('what happens to tech in 2022?' must refuse), prompt injection. Then draft the 5-section pitch outline against docs/context/RUBRIC.md."
**C:** "Implement engine/guard.py + replay per owner C using A.build and B.coach stubs. Guard rules in PROJECT.md. Replay month by month 2022-01..2023-12 returning ours vs QQQ values + GuardEvents. db/store.py to Cosmos with local fallback, log every call. Update app/replay to show coach pop-ups; keep mock fallback."

## Definition of done per feature
Real endpoint matches `docs/api-contract.md` · works with `USE_MOCKS=0` · pytest passes · screen works end to end · logged to `db.store` · entry in HANDOFF.
