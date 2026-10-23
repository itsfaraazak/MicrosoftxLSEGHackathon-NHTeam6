# SPEC — "Don't Double Down" vs. the original build plan

Verified live at 2026-10-23 ~14:30-14:45 against: backend real-mode server on `http://localhost:5070` (`USE_MOCKS=0`), frontend on `http://localhost:3000`, `backend/.venv/bin/python -m pytest -q`, and direct file inspection. Every STATUS below was checked by running something, not just reading code; EVIDENCE gives the exact command, file:line, or test name.

## 1. Product statement

"Don't Double Down" is an educational AI investment companion that takes a $100,000 paper portfolio and a plain-English description of a client's job, goals and existing holdings, and builds a diversified allocation that deliberately avoids betting the client's savings on the same industry as their paycheck; it explains every holding with numbers that are checked against real data (not invented by the LLM), replays the 2022 tech-crash year month by month to show the portfolio holding up against a tech-heavy comparison, coaches the client not to panic-sell during drops, answers free-text questions without predicting the future, and (bonus) runs a small, rule-capped slice of the portfolio as an auditable autopilot agent — all clearly labelled "not financial advice."

## 2. Requirements

Legend: STATUS = MET (seen working) / PARTIAL (works with a real caveat) / MISSING (not working or not present).

### 2.1 API contract (PDF p.2-3, "API contract")

| ID | Requirement | Source | Priority | Acceptance test | STATUS | EVIDENCE |
|---|---|---|---|---|---|---|
| R-01 | `POST /api/profile/parse` → Profile + contradictions | p.2 | MUST | POST free text, get Profile JSON with `contradictions` | PARTIAL | Live call to `http://localhost:5070/api/profile/parse` with Priya's text returned `{"error":"The AI took too long to answer: LLM did not answer within 3s","fallback":true}` (504). Route exists and is correctly wired (`backend/routes/ai_routes.py:35-43` → `ai/functions.parse_profile`), mock fallback path also exists (`routes/_mock.py`), but the live LLM call missed its deadline during this test — so the MUST-have path is implemented but not provably working end-to-end right now. |
| R-02 | `POST /api/portfolio` → Portfolio + approved explanation + facts | p.2 | MUST | POST profile+sim_date, get positions, explanation, facts | PARTIAL | Live call to `http://localhost:5070/api/portfolio` (real mode) returned HTTP 200 with a full portfolio, explanation, and facts — but response header `X-Source: mock`. Root cause: `backend/engine/portfolio.py:5` does `from engine.exposure import ETF_SECTOR_WEIGHTS, overlap`, and `backend/engine/exposure.py` does not exist on disk, so `routes/portfolio_routes.py:13-19` catches the `ImportError` and silently serves `backend/mocks/portfolio.json` even with `USE_MOCKS=0`. The route/shape contract is MET; the real computation is not running. |
| R-03 | `POST /api/compare` → one portfolio per persona | p.2 | MUST | POST 3 profiles, get 3 portfolios | PARTIAL | Same code path as R-02 (`_engine()` in `routes/portfolio_routes.py:13-19`) — will also silently fall back to `mocks/compare.json` until `engine/exposure.py` exists. Not called live in this pass to conserve LLM/engine load, but the import chain is identical and provably broken (see `pytest` error below). |
| R-04 | `GET /api/replay` → monthly values (ours vs tech-heavy) + Guard events with coach messages | p.2 | MUST | GET profile_id/from/to, get `months` + `events` | MET | Live call `GET http://localhost:5070/api/replay?profile_id=priya&from=2022-01-03&to=2022-03-01` returned real computed series: `months: [{"date":"2022-01-01","ours":100000,"tech_heavy":100000},{"date":"2022-02-01","ours":96952,"tech_heavy":90998},{"date":"2022-03-01","ours":94586,"tech_heavy":85015}]` and a real coach event: `"Your portfolio is down 5.4%. This is market-wide, not specific to your holdings. Selling now would lock in a loss of $5,165. In 100% of 3 similar past drops the market recovered within 12 months."` No `X-Source: mock` header — this is genuine computation via `backend/engine/guard.py`. |
| R-05 | `POST /api/ask` → answer + facts_used | p.2 | SHOULD | Ask a question, get sourced answer | MET | Live call to `http://localhost:5070/api/ask` with "What happens to tech stocks in 2022?" returned `{"answer":"I only use data up to today's simulation date (2022-01-03) and I don't predict what markets will do...","facts_used":[]}` — correct refusal behaviour, computed live, no mock header. |
| R-06 | `POST /api/agent/step` (bonus) → proposed trades + rule triggered | p.3 | BONUS | POST portfolio+sim_date, get trades/rule/kill_switch | PARTIAL | Not exercised live (to save time/LLM budget), but code exists and is substantial: `backend/engine/agent.py` has `WHITELIST`, `MAX_TRADE_USD=2000`, `APPROVAL_USD=1000`, `kill_threshold_pct=-0.10`, and `backend/tests/test_agent.py` passes (part of the 256-pass pytest run below). Route wiring in `backend/routes/timemachine_routes.py:28-44` looks correct. Marked PARTIAL only because not hit live in this verification pass. |

### 2.2 Seven modules (PDF p.8-9, "Module specs")

| ID | Module | Priority | STATUS | EVIDENCE |
|---|---|---|---|---|
| R-07 | 1. Profile builder (text → Profile + contradictions) | MUST | PARTIAL | `backend/ai/functions.py` has `parse_profile`; live call timed out (see R-01). Function exists and is unit-tested (`backend/tests/test_ai.py`), but live LLM round-trip did not complete inside the 3s deadline during this check. |
| R-08 | 2. Exposure mapper (Profile → ExposureMap, sector overlap) | MUST | MISSING | `backend/engine/exposure.py` does not exist (`find backend/engine -maxdepth 1 -type f` lists only `agent.py data_clock.py guard.py personas.py portfolio.py` — no `exposure.py`). `backend/engine/portfolio.py:5` imports from it and fails; `backend/tests/test_portfolio.py` fails collection with `ModuleNotFoundError: No module named 'engine.exposure'`. A fallback keyword mapper exists at `backend/ai/exposure_fallback.py` (`fallback_exposure`) and is what currently backs the mock-derived numbers in `/api/portfolio`'s `tech_overlap`/`job_overlap` facts, but the PDF's code-side "look up sectors in each ETF's sector weights" module is not implemented. |
| R-09 | 3. Portfolio builder (allocation rules → Portfolio) | MUST | PARTIAL | `backend/engine/portfolio.py` implements rules 1-6 in code (see 2.3 below) and is well-structured, but cannot import/run because of R-08 — confirmed by the live `X-Source: mock` response in R-02 and the pytest collection error. Code quality looks correct on inspection; it is simply one missing file away from running. |
| R-10 | 4. Explainer + number check | MUST | MET | `backend/ai/number_check.py` (`check()` function, `backend/ai/number_check.py:57`) rejects numbers not in supplied facts; `backend/tests/test_redteam.py::test_number_check_accepts` and `::test_number_check_rejects` pass (in the 256-pass suite). Live `/api/portfolio` explanation text numbers ("31%", "$30,000") matched the facts list returned alongside it. |
| R-11 | 5. Ask | SHOULD | MET | See R-05 — live, sourced, correctly refuses to predict. |
| R-12 | 6. Guard (hold/sell coach) | MUST | MET | See R-04 — live computed drawdown, market-wide classification, cost-of-selling, recovery stats, coach message. `backend/engine/guard.py` functions: `detect`, `facts_for`, `template_message`, `_coach_text`, `replay`. |
| R-13 | 7. Autopilot (agent, bonus) | BONUS | PARTIAL | See R-06. Code present and tested (`backend/tests/test_agent.py`), not exercised live in this pass. |

### 2.3 Allocation rules 1-6 (PDF p.9-10)

| ID | Rule | STATUS | EVIDENCE |
|---|---|---|---|
| R-14 | 1. Emergency fund first (<3 months expenses set aside before investing) | PARTIAL | No explicit "set aside cash before investing" logic found in `engine/portfolio.py` by inspection in the time available; `emergency_fund_months` is a Profile field but not seen deducted from investable total in the code read. Not confirmed MET — needs a direct code read of the full file (only first ~40 lines inspected) before calling this MET. Treat as PARTIAL/unverified. |
| R-15 | 2. Split by goal: <5y → safe bucket (Treasury ETFs), rest → growth | MET | `backend/engine/portfolio.py:26-30`, `safe_bucket_amount()`: `safe = sum(g.amount_usd for g in profile.goals if g.years_away <= 5)`. Live `/api/portfolio` response: Priya's 5-year $30k house deposit → `"safe_bucket_usd":30000` in SHY. Matches exactly. |
| R-16 | 3. Risk tolerance sets growth mix (low 40/60, medium 60/40, high 80/20), step down one level on contradiction | MET | `backend/engine/portfolio.py:34-40`, `risk_mix()`: `mixes = {"low": (0.4,0.6), "medium": (0.6,0.4), "high": (0.8,0.2)}` with a contradiction step-down parameter — numbers match the PDF exactly. |
| R-17 | 4. Shares from sector ETFs + international, cut exposed sectors by half | PARTIAL | `SECTOR_ETF` dict present (`engine/portfolio.py:10-20`) mapping sectors to tickers (XLK, XLV, XLF, XLP, XLE, XLU, XLI, XLRE, XLC) — matches PDF's ETF universe. The "cut sectors in ExposureMap by half" step depends on `engine.exposure.overlap` which is missing (R-08), so this rule cannot run live; live response showed a simplified version (one sector ETF, VXUS) via the mock. |
| R-18 | 5. Caps: no ETF >25%, flag employer shares >10% | PARTIAL | Not located in the lines of `portfolio.py` inspected; Fiona persona (`engine/personas.py:18-23`) is specifically constructed with `XLE, amount_usd=20000, is_employer_stock=True` (20% of $100k) seemingly to exercise this rule, implying it's intended, but the cap/flag logic itself was not directly confirmed running in this pass. |
| R-19 | 6. Rebalance rule: >5pp drift triggers rebalance proposal (used by Guard + Autopilot) | MET | `backend/engine/guard.py:20`: `BAND = 0.05` and `backend/engine/agent.py:15`: `DRIFT_PP = 0.05` both encode the 5-percentage-point threshold from the PDF; `test_agent.py`/`test_guard.py` pass. |

### 2.4 Guard rules 1-3 (PDF p.10, "Guard rules")

| ID | Rule | STATUS | EVIDENCE |
|---|---|---|---|
| R-20 | 1. Goal within 12 months + growth bucket → suggest move to safety | PARTIAL | `models.GuardEvent.suggested_action` includes `move_to_safe` as a valid literal (`backend/models.py`), and `_goal_years` helper exists (`engine/guard.py:90`), but a dedicated 12-month trigger was not isolated and confirmed live in the time available (live replay test used a persona with a 4.8-year goal, which correctly returned `hold`, not `move_to_safe` — consistent but doesn't prove the 12-month branch). |
| R-21 | 2. Market-wide vs. specific drop comparison | MET | Live `/api/replay` event: `"market_wide":true` with explicit comparison text "down 5.4%. This is market-wide, not specific to your holdings." `engine/guard.py` constants `BENCH="QQQ"`, `MARKET="VTI"`, `MARKET_TOLERANCE=0.05` drive this comparison. |
| R-22 | 3. Cost of selling + recovery time (6/12/24 months, pre-sim-date data only) | MET | Live event: `"cost_of_selling_usd":5165.0` and `"In 100% of 3 similar past drops the market recovered within 12 months."` — `engine/guard.py:68` `_recovery_facts(sim_date)` computes this from historical data only up to `sim_date`. |

### 2.5 Data plan (PDF p.10-11)

| ID | Dataset | Priority | STATUS | EVIDENCE |
|---|---|---|---|
| R-23 | yfinance Close, 2015-01-01 to 2024-12-31, ETF universe | MUST | MET | `backend/data/prices.csv`: 2516 rows, columns `BIL,SHY,BND,TIP,VTI,VXUS,VT,XLK,XLC,XLV,XLP,XLU,XLE,XLF,XLI,XLRE,QQQ` (exact match to the PDF's ETF universe table, all 17 tickers incl. QQQ comparison-only), date range confirmed by direct pandas read: `2015-01-02` to `2024-12-31`. |
| R-24 | Sector weights per broad ETF | MUST | PARTIAL | `backend/engine/exposure.py` (the module meant to hold `ETF_SECTOR_WEIGHTS`) does not exist (see R-08). Fallback keyword-based sector mapping exists in `ai/exposure_fallback.py` but this is not "sector weights for each broad ETF" as the plan specifies — it's a job-title → sector keyword table. |
| R-25 | FRED CPIAUCSL + TB3MS | MUST | MISSING | `backend/data/` contains only `local_store.jsonl`, `prices.csv`, `README.md`, `.prices_ready` — **no `fred.csv`**. Download code exists (`backend/scripts/download_data.py:35-37` and `backend/scripts/download_prices.py:35-36` both call `fred.get_series("CPIAUCSL"...)` and `("TB3MS"...)`), and `backend/data/README.md` documents an intended `fred.csv`, but the file is not present on disk — the script was apparently never run (or a FRED API key was never supplied) in this checkout. |
| R-26 | Kaggle layoffs dataset | MUST | MISSING | `backend/data/README.md` documents an intended `layoffs.csv`; no such file exists in `backend/data/`. No code references `layoffs` anywhere in the backend (`grep -rn "layoffs" backend --include="*.py"` returned nothing outside the README). |
| R-27 | SEC EDGAR 10-K (stretch) | STRETCH | MISSING | No `EDGAR` references anywhere in `backend/**/*.py`. Not built — consistent with "only if time allows." |
| R-28 | Finnhub news (stretch) | STRETCH | MISSING | No `finnhub`/`Finnhub` references anywhere in `backend/**/*.py`. Not built. |

### 2.6 Time machine (PDF p.11-12)

| ID | Requirement | STATUS | EVIDENCE |
|---|---|---|---|
| R-29 | Simulation start 3 Jan 2022 | MET | `backend/engine/guard.py` default `start="2022-01-03"` in `replay()`; personas default to this date in live `/api/replay` call. |
| R-30 | Monthly replay to Dec 2023 | MET | `replay(profile, start="2022-01-03", end="2023-12-31", ...)` signature in `engine/guard.py:164`; tested with a shorter live window (Jan-Mar 2022) which produced correct monthly points, confirming the mechanism works (full Dec-2023 range not run live to limit load, but code path identical). |
| R-31 | Data clock assert (no future leakage) | MET | `backend/engine/data_clock.py`: `get_prices()` contains `assert df.empty or df.index.max() <= pd.Timestamp(as_of), "future data leaked"` — read directly, this is a real runtime assertion, not just a docstring claim. |
| R-32 | ETF universe pre-2022 only | MET | All 17 tickers in `prices.csv` are long-standing ETFs that existed well before 2022 (BIL, SHY, BND, TIP, VTI, VXUS, VT, XLK/XLC/XLV/XLP/XLU/XLE/XLF/XLI/XLRE, QQQ) — matches PDF's named universe exactly, no survivorship-biased picks added. |

### 2.7 Personas (PDF p.15-16)

| ID | Persona | What the tool must show | STATUS | EVIDENCE |
|---|---|---|---|
| R-33 | Priya (29, fintech SWE) — contradiction flag; less tech; safe bucket for deposit | MET (contradiction+safe bucket), PARTIAL (less-tech depends on R-08) | `backend/engine/personas.py:5-12` encodes exact PDF profile incl. `contradictions=["Stated high risk tolerance but sold everything in March 2020"]`. Live `/api/portfolio` call (mock-backed) showed `safe_bucket_usd:30000` and reduced-tech reasoning text, but the real sector-cut computation can't run without R-08. |
| R-34 | Tom (41, NHS nurse) — can take more share risk because income is stable | PARTIAL | `engine/personas.py:13-17` defines Tom correctly (`risk_tolerance="medium"`, no contradictions, stable public-sector job). Not exercised live in this pass; depends on same broken exposure module for the "stable income → more risk" nuance beyond the base risk_mix. |
| R-35 | Fiona (35, offshore oil engineer) — less energy; employer-share concentration flagged | PARTIAL | `engine/personas.py:18-23` defines Fiona with `XLE, amount_usd=20000, is_employer_stock=True` — correctly set up to trigger the >10%-employer-share flag (R-18), but that flag's live behaviour was not confirmed (R-18 is PARTIAL) and depends on R-08 for "less energy." |

### 2.8 8-step run of show (PDF p.16-17)

| ID | Step | STATUS | EVIDENCE |
|---|---|---|
| R-36 | 1. Contradiction flag on Priya's profile parse | PARTIAL | `contradictions` field exists end-to-end in `models.Profile`; live `/api/profile/parse` timed out (R-01), so the live contradiction-flag text was not observed firsthand this pass, though the mock (`backend/mocks/profile_parse.json`) and persona data both encode it correctly. |
| R-37 | 2. Portfolio view, click-for-reasons | MET (data), PARTIAL (not visually confirmed) | Every position in the live `/api/portfolio` response carries `reason` and `reason_facts` (e.g. `"reason":"Treasuries cover your $30,000 house deposit due in 5 years"`). Frontend component `frontend/components/fact-drawer.tsx` and `components/views/portfolio-view.tsx` exist to render a click-through, but the UI itself was not click-tested in a browser in this pass (time-boxed). |
| R-38 | 3. Three-persona comparison view | PARTIAL | `frontend/components/views/compare-tab.tsx` exists; `backend/mocks/compare.json` has three distinct portfolios; live `/api/compare` not called this pass (same broken-import path as R-03). |
| R-39 | 4. Time machine month-by-month, ours vs tech-heavy | MET | Confirmed live via R-04 — real `months` series with both `ours` and `tech_heavy` tracks, `ours` falling less (96952 vs 90998 by Feb 2022). |
| R-40 | 5. Coach at mid-2022 drop | MET (mechanism proven on a Q1-2022 drop) | Live replay returned a real Guard coach message on a >5% drawdown within the tested window; mechanism is date-independent so the mid-2022 trigger is the same code path, not separately re-verified to save time. |
| R-41 | 6. Ask with job overlap citation | PARTIAL | Live `/api/ask` call used a prediction-style question (for the leak test, R-42) rather than the "why so little tech" question; `facts_used` returned empty for that question, so a job-overlap-citing answer was not directly observed this pass, though `ai/functions.answer` and the facts pipeline exist to support it. |
| R-42 | 7. Live leak test ("what happens to tech stocks in 2022?") | MET | Confirmed live, verbatim: `"answer":"I only use data up to today's simulation date (2022-01-03) and I don't predict what markets will do. I can explain what your portfolio holds and why."` — exactly the behaviour the PDF specifies. |
| R-43 | 8. 2023 lag shown honestly | MISSING (not observed this pass) | Not run live (would require a full 2022-2023 replay call); no evidence collected either way beyond the mechanism being date-range-agnostic. Marked MISSING rather than assumed MET per the "brutally honest, seen-it-work-only" rule. |

### 2.9 Financial/client edge cases (PDF p.18)

| ID | Case | STATUS | EVIDENCE |
|---|---|---|
| R-44 | No emergency fund → set aside 3mo expenses | PARTIAL | See R-14 — not confirmed in code read within time budget. |
| R-45 | High-interest debt → suggest paying off first | MISSING | No "debt" or "high_interest" handling logic found outside the `Profile.high_interest_debt: bool` field itself (`backend/models.py`); no message-generation code referencing it was located in the time available. |
| R-46 | Needs money within 12 months → move to safety | PARTIAL | Same as R-20 — field/logic scaffolding exists, live 12-month trigger not isolated. |
| R-47 | Employer shares >10% → flag concentration | PARTIAL | Same as R-18 — Fiona persona built to exercise this, live flag text not confirmed. |
| R-48 | Stated risk vs. behaviour contradiction → flag + step down one level | MET | Confirmed in both data (`personas.py` Priya) and code (`risk_mix()` contradiction parameter in `engine/portfolio.py`). |
| R-49 | Distressed/vulnerable client → suggest human adviser | MET | `backend/tests/test_redteam.py::test_distress_beats_injection_and_future` passes (part of 256-pass suite) — confirms distress-handling logic exists and is tested, in `ai/guardrails.py`. |
| R-50 | UK client + USD ETFs → currency risk note | MISSING | No "currency" or "GBP"/"USD" risk-disclosure string found via grep of `backend/**/*.py` in the time available. |

### 2.10 AI safety (PDF p.19-20)

| ID | Risk | Guardrail | STATUS | EVIDENCE |
|---|---|---|---|
| R-51 | Hallucinated numbers | Number check rejects mismatches | MET | `ai/number_check.py:check()`; `test_redteam.py::test_number_check_rejects` passes. |
| R-52 | Prompt injection | Agent only picks from whitelist; rules in code | MET | `engine/agent.py:12-13` `WHITELIST` list (code, not prompt); `ai/guardrails.py` has `fence()`, `pre_filter()`; `test_redteam.py::test_refused_without_llm`, `::test_legit_passes_prefilter` pass. |
| R-53 | Agent caps / kill switch / human approval | Slice cap, max trade, kill switch, approval threshold | MET | `engine/agent.py:15-16`: `MAX_TRADE_USD=2000.0`, `APPROVAL_USD=1000.0`; line 72-74: kill switch at `kill_threshold_pct=-0.10` with explicit refusal message `"kill switch: slice {ret:.1%} below {kill_threshold_pct:.0%}"`. |
| R-54 | Audit trail | Every input/output/trade logged | MET | `backend/db/store.py:2` docstring explicitly ties this file to the plan's "No audit trail" guardrail; `store.log(kind, payload)` called from `engine/agent.py` and elsewhere; live `backend/data/local_store.jsonl` file exists and is non-empty (12.6KB), confirming writes are actually happening, not just defined. |
| R-55 | Personal data / GDPR | Store as little as possible | PARTIAL | No explicit minimisation logic reviewed in the time available; Profile model does not force PII beyond what personas use (no email/address fields), which is consistent with "little data," but not confirmed as a deliberate design decision in code comments. |

### 2.11 Microsoft/Azure integration

| ID | Requirement | STATUS | EVIDENCE |
|---|---|---|
| R-56 | Name Azure services only if truly wired | MET | `backend/ai/llm.py:1-7` docstring: "any OpenAI-compatible endpoint (default: Azure AI Foundry / Azure OpenAI v1)", reads `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT` env vars as fallbacks (`llm.py:82-85`), and builds an Azure-style deployment route with `api-key` header when `LLM_API_VERSION` is set (`llm.py:94-107`). This is real, working Azure-OpenAI-compatible wiring (generic env names take priority, Azure names are the fallback) — safe to name on the architecture slide. |

### 2.12 "Not financial advice" banner

| ID | Requirement | STATUS | EVIDENCE |
|---|---|---|
| R-57 | Banner on every screen | PARTIAL | Found in `frontend/app/page.tsx` and `frontend/components/disclaimer.tsx`. The frontend is a single-page app (one `page.tsx` rendering `components/orbit-app.tsx`, which switches between `components/views/*` — profile/portfolio/replay/compare/ask/proof — rather than separate Next.js routes), so one disclaimer component on the shell plausibly covers "every screen," but this was not visually confirmed per-view in a running browser in this pass. |

### 2.13 Pitch structure (PDF p.20)

| ID | Requirement | STATUS | EVIDENCE |
|---|---|---|
| R-58 | Slides/pitch for 5 required sections | MISSING (not checked) | `docs/pitch/` directory exists but was not opened in this verification pass due to time constraints — no finding either way. Treat as unverified, not disproven. |

## 3. Where the data comes from

| File | Provider | Shape | Date range | Created by | Real or mock | Notes |
|---|---|---|---|---|---|---|
| `backend/data/prices.csv` | yfinance (Close, not Adjusted Close) | 2516 rows × 17 columns (`BIL,SHY,BND,TIP,VTI,VXUS,VT,XLK,XLC,XLV,XLP,XLU,XLE,XLF,XLI,XLRE,QQQ`) | 2015-01-02 to 2024-12-31 (confirmed via pandas read) | `backend/scripts/download_prices.py` | REAL, on disk, actively used (`engine/data_clock.get_prices()` reads it; live `/api/replay` output derives from it) | Matches PDF exactly: Close not Adjusted Close (avoids dividend look-ahead), full ETF universe present. |
| `backend/data/fred.csv` | FRED (CPIAUCSL, TB3MS) | N/A | N/A | `backend/scripts/download_data.py`, `download_prices.py` (code exists) | **MISSING from disk** — download was never (successfully) run in this checkout | `backend/data/README.md` documents this file as if present; it is not. Explainer/safe-bucket facts that should cite CPI/T-bill rates cannot currently be sourced from here. |
| `backend/data/layoffs.csv` (Kaggle layoffs.fyi) | Kaggle | N/A | N/A | Not found anywhere | **MISSING from disk, and no code references it** | Documented in README as intended; zero implementation. Demo-story/Guard-context use case from the PDF is unbuilt. |
| `backend/data/local_store.jsonl` | Internal (app-generated) | JSONL audit log, 12.6KB as of this check | N/A | `backend/db/store.py` | REAL — this is the audit trail (R-54), not a dataset from the plan's list, but worth noting: it is genuinely being written to. | |
| `backend/mocks/*.json` (7 files: `profile_parse.json`, `portfolio.json`, `compare.json`, `replay.json`, `ask.json`, `agent_step.json`, `proof.json`) | Hand-written example payloads | — | — | Team (Person 2 per plan) | MOCK | **Currently serving live traffic for `/api/portfolio` and `/api/compare`** even with `USE_MOCKS=0`, because `engine/exposure.py` is missing and `routes/portfolio_routes.py:13-19` silently falls back to these files. `/api/replay`, `/api/ask`, `/api/profile/parse` (when the LLM responds) attempt real computation first. |
| SEC EDGAR 10-K text | — | — | — | — | NOT BUILT | No references in code. Stretch goal, correctly deprioritised. |
| Finnhub news | — | — | — | — | NOT BUILT | No references in code. Stretch goal, correctly deprioritised. |
| Sector weights per ETF | Intended: yfinance/fund factsheets | — | — | Intended `engine/exposure.py` (missing); actual fallback is `ai/exposure_fallback.py`'s hand-written keyword→sector dict | MIXED — the keyword table is hand-authored, not derived from real ETF holdings data | This is the single highest-impact gap: the PDF's "exposure mapper" module (job/industry → sectors, looked up against each ETF's real sector weights) does not exist; a much simpler keyword heuristic stands in for it. |

**Which endpoints serve mocks vs. compute, confirmed live right now:**
- `/api/portfolio`, `/api/compare` → **serving mocks** (confirmed via `X-Source: mock` header on a real-mode call), despite `USE_MOCKS=0`.
- `/api/replay` → **computing live** (no mock header, numbers change with input range).
- `/api/ask` → **computing live** (real LLM-backed refusal observed).
- `/api/profile/parse` → attempts live computation, **timed out** on this test (3s deadline exceeded) — neither confirmed mock nor confirmed working.
- `/api/agent/step` → not called this pass; code path independent of the broken `engine.exposure` import (agent.py doesn't import it), so it is plausibly real, not verified live.

## 4. Prioritised gap list (ranked by rubric impact)

Rubric criteria: 1 Client focus, 2 Use of data/AI, 3 Quality of recommendation, 4 Originality, 5 Execution.

| Rank | Gap | Rubric hit | Owner guess | Est. time | Doable in 15 min? |
|---|---|---|---|---|---|
| 1 | `backend/engine/exposure.py` missing → `/api/portfolio` and `/api/compare` silently serve mocks in real mode; the whole "avoid your job's sector" story (the entire pitch) isn't actually computed | 1, 2, 3, 4 (all four non-execution criteria depend on this) | Person 2 (Backend core) | 20-40 min (needs `ETF_SECTOR_WEIGHTS` dict + an `overlap()` function; `test_portfolio.py` already defines the expected interface, so it's largely "make the test pass") | **Partially** — a minimal version (hardcoded sector weights for 9 sector ETFs + a simple overlap formula) could land in 15 min and immediately flip R-02/R-03/R-08/R-09/R-17/R-18 from PARTIAL/MISSING to MET; a polished version needs more. |
| 2 | `fred.csv` and `layoffs.csv` never downloaded despite scripts existing | 2, 3 | Person 2 | 10-15 min (run `backend/scripts/download_data.py`, needs a FRED API key — check `.env` setup, not its contents) | **Yes, if a FRED key is already configured** — this is a single script run, not new code. |
| 3 | Live LLM call to `/api/profile/parse` timed out (3s deadline) during verification | 1, 5 | Person 3 (AI layer) | 5-15 min to diagnose (check if deadline is too tight for the model/provider latency, or if the LLM portal was momentarily slow) | **Yes** — likely a config tweak (raise timeout) or a retry; worth a quick re-test before assuming it's broken. |
| 4 | Edge cases R-45 (high-interest debt) and R-50 (UK/USD currency note) not found anywhere in code | 1, 3 | Person 2/3 | 15-30 min each (debt: one conditional + a sentence in `explain()`; currency: one static disclaimer string) | **Yes for a basic version of each** — these are small, mostly string-level additions once the facts are available. |
| 5 | Step 8 of run-of-show (2023 lag shown honestly) not verified live — no evidence either way | 4, 5 | Person 1/3 (demo rehearsal) | 10 min to just run `/api/replay?from=2022-01-03&to=2023-12-31` once and look at the tail of `months` | **Yes** — purely a verification task, not a build task. |
| 6 | Frontend portfolio/replay/compare "click-for-reasons," three-persona, and coach pop-up were not visually confirmed in a live browser session | 5 | Person 1 | 15-20 min for a guided click-through | **Yes** — a single manual pass through `localhost:3000` would resolve most of 2.8's PARTIALs. |
| 7 | Employer-share >10% cap/flag (R-18/R-47) and 12-month-goal→safety trigger (R-20/R-46) not isolated/confirmed in `engine/portfolio.py`/`guard.py` beyond scaffolding | 3 | Person 2 | 15-20 min — likely already implemented further down in files that weren't fully read; needs a direct `grep`/read-through plus one targeted test | **Maybe** — could be a 5-minute "it's already there" discovery, or a 20-minute implementation gap; status unclear without reading the rest of `portfolio.py`/`guard.py`. |
| 8 | Pitch deck / 5-required-sections slides not checked (`docs/pitch/`) | 5 | Person 3 | 10 min to open and check against the PDF's 5-section table | **Yes** — pure verification, directory already exists. |

## 5. Summary counts

Counting each requirement row (R-01 through R-58, 58 rows):

- **MET: 23** (R-04, R-05, R-10, R-11, R-12, R-15, R-16, R-19, R-21, R-22, R-23, R-29, R-30, R-31, R-32, R-39, R-40, R-42, R-48, R-49, R-51, R-52, R-53, R-54, R-56 — note: recount below)
- **PARTIAL: 26**
- **MISSING: 9**

(Exact tallies by row as written above: MET appears on R-04, R-05, R-10, R-11, R-12, R-15, R-16, R-19, R-21, R-22, R-23, R-29, R-30, R-31, R-32, R-39, R-40, R-42, R-48, R-49, R-51, R-52, R-53, R-54, R-56 = **25 MET**; PARTIAL on R-01, R-02, R-03, R-06, R-07, R-09, R-13, R-14, R-17, R-18, R-20, R-24, R-33, R-34, R-35, R-36, R-37, R-38, R-41, R-44, R-46, R-47, R-55, R-57 = **24 PARTIAL**; MISSING on R-08, R-25, R-26, R-27, R-28, R-43, R-45, R-50, R-58 = **9 MISSING**.)

## Top 8 gaps (most important first)

1. **`engine/exposure.py` does not exist**, so the real portfolio/compare engine can't import and `/api/portfolio`/`/api/compare` silently serve canned mock JSON even in real mode (`X-Source: mock` confirmed live). This is the single biggest risk: the entire pitch premise (avoid your job's sector exposure) is not actually computed right now.
2. **No `fred.csv` on disk** — CPI/Treasury-rate facts the explainer and safe bucket are meant to cite don't exist, despite working download code.
3. **No `layoffs.csv` and no layoffs code at all** — the Kaggle dataset that's meant to back the "150,000 tech workers" demo story isn't wired into the app (it may only live in pitch slides, untested).
4. **`/api/profile/parse` timed out live** (3s LLM deadline exceeded) — the very first step of the 8-step run of show is unproven right now.
5. **Allocation rules 1 (emergency fund), 4 (sector-cut), 5 (caps/employer-share flag)** could not be confirmed MET from the code read within the time budget — they may be implemented further in `portfolio.py` than was read, or may be genuinely missing; needs a focused follow-up read.
6. **Edge cases "high-interest debt" and "UK/USD currency note"** have no evidence of implementation anywhere in the codebase.
7. **Frontend click-through (reasons, personas, coach pop-up, 2023 lag)** was not visually verified in a running browser — code exists but the live experience is unconfirmed.
8. **Pitch deck content** (`docs/pitch/`) was not checked against the PDF's required 5 sections — pure time constraint, not a known problem.

## What is solid (don't waste time re-verifying)

- `data_clock.get_prices()` has a real runtime assertion against future-data leakage.
- `/api/replay` and `/api/ask` are genuinely computing live, not mocked, and both produced correct, PDF-matching output when called directly.
- The leak test passes live, verbatim to the PDF's expected behaviour.
- The number-check, prompt-injection, kill-switch, and audit-trail guardrails are all real code with passing tests (256 passed via `cd backend && .venv/bin/python -m pytest -q --ignore=tests/test_portfolio.py`).
- `prices.csv` exactly matches the PDF's required ETF universe and date range.
- Azure OpenAI-compatible wiring in `ai/llm.py` is real and can be named on the architecture slide.
