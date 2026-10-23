# Plan: B — AI Layer + pitch (owner: Faraaz) — status as of 13:58
Goal: five plain-Python functions that Flask routes and A/C call, every LLM output number-checked, demo survives with no LLM.

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Shared models + number check (years/dates exempt, future years rejected, `30k` handled) | DONE | `ai/number_check.py`, tests |
| 2 | Guardrails before the LLM: look-ahead, injection, distress → refusal in code | DONE | `ai/guardrails.py`; live leak test = refusal, LLM never called |
| 3 | `llm.chat` on Azure v1 endpoint, system prompt "Today is {sim_date}…", fenced user text | DONE (untested live) | needs endpoint/key/deployment |
| 4 | `parse_profile` + code-side contradiction flag + retry on bad JSON | DONE | 422 from route if unparseable |
| 5 | `map_exposure` validated against sector whitelist, keyword fallback | DONE | A consumes it |
| 6 | `explain` with regenerate-on-bad-number, deterministic template fallback | DONE | never shows unchecked numbers |
| 7 | `answer` (Ask) from fact slice; `coach` for Guard events | DONE | uses mock facts until A's `build` is live |
| 8 | **Live Azure smoke test** (`python scripts/ai_smoke.py`) | BLOCKED | need endpoint + deployment from coach |
| 9 | Pitch: slides outline, Q&A sheet, Azure architecture wording | DRAFT | `docs/pitch/` |
| 10 | AI-security coach tries to break it; add failures as tests | TODO 14:15 | ask Alexander Ager (LSEG, AI security) |
| 11 | Wire A's `portfolio.build` into `answer`/route; wire C's coach call | TODO at 14:30 checkpoint | see interfaces in BACKEND-PLAN |
| 12 | Frontend: profile input page polish + Ask panel | TODO | `app/page.tsx`, new `components/ask-panel.tsx` |
| 13 | Two timed rehearsals under 8:00 | TODO 14:45–15:15 | |

Risks: Azure not provisioned → everything still demos via fallbacks (templates/keyword map), say so honestly in Q&A.
Hard rule held: LLM never picks holdings, never sees raw price data, never predicts.
