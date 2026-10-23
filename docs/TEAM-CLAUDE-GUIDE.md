# How to vibe-code this app with Claude Code (team guide)

## 0. One-time setup (5 min)
1. Clone the repo. `cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
2. `cd frontend && npm install`
3. `cp backend/.env.example backend/.env` and `cp frontend/.env.local.example frontend/.env.local`; get values from the team lead (never from screenshots in git).
4. Install Claude Code, run `claude` in the repo ROOT (not a subfolder) so it loads `CLAUDE.md` and `.claude/commands`.

## 1. The loop (every session)
1. `/sync` — Claude reads CLAUDE.md, PROJECT.md, latest HANDOFF + decisions, and tells you where the team is.
2. Say what YOU own (see ownership in CLAUDE.md) and the next checklist item. Ask Claude to plan first for anything touching the API contract.
3. Build in small slices; run the app and tests after each (`/check`). Commit often on your own branch: `p1/…`, `p2/…`, `p3/…`.
4. `/handoff` — Claude appends to docs/HANDOFF.md (and docs/decisions.md if you decided something). Commit + push + open PR / merge to main.
5. `git pull` before every new session so your Claude sees teammates' context.

## 2. Sharing context between people and Claudes
- Source of truth = git: `CLAUDE.md` (rules), `docs/context/*` (project, rubric, Azure, LSEG), `docs/api-contract.md`, `docs/decisions.md`, `docs/HANDOFF.md`.
- Never rely on chat history. If it matters, it goes in a doc. If you change the contract/data model: edit docs first, tell the others, log a decision.
- Personal prefs only in `CLAUDE.local.md` or `.claude/settings.local.json` (both gitignored).
- Parallel Claudes: one area per person; use `git worktree add ../dd-p2 -b p2/engine` to run several Claude sessions without collisions.

## 3. Prompts that work
- "Read docs/context/PROJECT.md and implement allocation rules 1–6 in backend/engine/portfolio.py as pure functions with pytest tests. Use only get_prices."
- "Build the three-persona compare screen against backend/mocks/compare.json; types in lib/api.ts; shadcn Card/Badge; mobile-first."
- "Wire ai/functions.explain to Azure OpenAI; reject output failing number_check; add a test."
- "Try to break ai/functions with prompt injection and look-ahead leaks; list failures."
- Pitch: "Check our 8-minute pitch against docs/context/RUBRIC.md; score each criterion 1–10 and say what to change."

## 4. Rules for Claude-assisted work
- Don't paste secrets or the credential sheet into Claude. Don't let Claude read `.env`.
- Review every diff before committing. Keep the demo path boring. Feature freeze 14:45.
- If Claude invents numbers, APIs or versions: check against npm/PyPI/docs. If stuck >10 min, ask a Microsoft/LSEG coach.

## 5. Commands (shared in .claude/commands)
/sync · /status · /check · /handoff · /pitch-check · /leak-test
