# Pitch (8:00 + 2:00 Q&A) — mapped to the rubric. Owner: B. Verify every statistic against the sources before 15:00.
Judge is from Microsoft: say "Azure" out loud and show it on the architecture slide.

| Time | Section | Say / show | Rubric criterion it earns |
|---|---|---|---|
| 0:00–1:00 | 01 The client | 2022 hook: 150,000 tech layoffs, Nasdaq −33%. Meet Priya. "Your investments shouldn't bet on the same thing your paycheck does." | Client focus |
| 1:00–1:45 | 02 The data | yfinance Close prices, FRED, layoffs (Kaggle). Time machine starts 3 Jan 2022; only past data visible. | Use of data |
| 1:45–3:00 | 03 What the AI does | Architecture slide: Next.js → Flask → **Azure AI Foundry/OpenAI** (parse, explain, coach) + **Azure Cosmos DB** (audit log) ; code decides, LLM explains; number check; data clock. | Use of data and AI, Originality |
| 3:00–6:30 | 04+05 Recommendation + demo | Run of show 1–8 in `docs/context/PROJECT.md`: profile → contradiction flag → portfolio → click a holding for sources → 3 personas → time machine → coach at mid-2022 → Ask → live leak test → 2023 lag. | Quality of recommendation, Execution |
| 6:30–7:30 | Trust and limits | Leak test result, honest 2023 lag, not financial advice, FCA authorisation for a real launch. | Quality of recommendation |
| 7:30–8:00 | Close | Who buys it: banks/apps doing FCA targeted support. Repeat the pitch line. | Client focus |

## Azure architecture slide wording (only list what is really wired by 14:45)
Azure AI Foundry / Azure OpenAI — profile parsing, explanations, coach messages · Azure Cosmos DB — audit log of every input/output/trade · (stretch) Application Insights — tracing. Offline fallback: CSVs + mocks so venue Wi-Fi can't break the demo.

## Q&A cheat sheet (answers in the PDF, p.20–21; short forms)
- LLM already knows 2022? → Yes, so it never decides or predicts; code decides from data ≤ sim date; leak test shown live.
- Robo-adviser? → We also model what your job exposes you to, and explain with sources.
- Why not ChatGPT? → Repeatable, every number checked against data, reasoning logged.
- Cherry-picked 2022? → We show 2023 where we lag. Point is avoiding a double hit.
- Who pays? → Banks/apps launching FCA targeted support. · Legal? → Paper money; real launch via authorised firm.
- Allocation rules? → Standard rules, reviewed by an LSEG coach. · Next? → Live data, UK funds/ISAs, LSEG feeds, more job types.
- Prompt injection? → Whitelisted ETFs, rules in code not prompt; injection refused before the model sees it.
- Is the AI really needed? → Yes: free-text → structured profile, job → sector exposure, plain-English reasons; analysis hard to do manually.

## Rehearsal log
(add: date/time, duration, what broke)
