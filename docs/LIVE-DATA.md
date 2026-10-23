# Live data: what "Go live" really does, and where it is (and is not) used

Audited from the code on 2026-10-23. Everything below is read from `backend/` and `frontend/`, not assumed.

## In one paragraph

"Go live" does two things. (1) The backend downloads any missing daily closing prices for the 17 ETFs from Yahoo Finance and
appends them to `backend/data/prices.csv`. (2) The frontend moves its simulation clock from 3 Jan 2022 to the newest trading day
on file. From then on, every request that carries the clock's date (`sim_date`) asks for data up to that new date.
It does **not** add news, earnings, intraday prices, company shares, or new sector weights. And several features never read prices at all
(see the table), so they look the same before and after.

## The simulation clock

- Frontend: `lib/app-state.tsx` keeps `clock.date` (starts `2022-01-03`) and `live` (`{active, latestDate}`, not persisted: a reload returns to 2022).
- Go live (`lib/live.ts` `useGoLive`): `POST /api/live/refresh`, then `GET /api/live/status`; the returned `latest_date` becomes `clock.date`.
  If the refresh fails (429 cooldown, 502, offline) it still goes live on the last good data and shows a notice.
- Backend: the only way any module reads prices is `engine/data_clock.get_prices(tickers, as_of)`, which filters strictly to `<= as_of`
  (asserted). `refresh` only extends the file on disk and calls `data_clock.reload()`; it never changes that rule.
- The Time machine moves `clock.date` through 2022-23 while you step months; in live mode it is paused (see replay row).

## Feature by feature

| Feature / endpoint | Uses live prices after Go live? | Why (from the code) |
|---|---|---|
| `POST /api/live/refresh` | It *is* the live step | Downloads closes from `period start = latest+1 day` to today via yfinance, appends atomically, 60 s cooldown (429), reloads the data clock. |
| `GET /api/live/status` | Yes | Reports `latest_date`, row/ticker counts and staleness of `prices.csv`. |
| `GET /api/live/quotes` | Yes, independent of the clock | Always asks yfinance for the last 5 days (cached 5 min), plus CPI YoY and 3-month T-bill from `fred.csv` (local file, ends Sep 2026). Drives the "Live market" sheet. |
| `POST /api/portfolio`, `/api/compare` | **No** | `engine/portfolio.py` and `engine/exposure.py` never call the data clock. Allocation = fixed rules + a hand-set table of end-2021 ETF sector weights. `sim_date` only stamps the `as_of` labels. A plan built live has the same amounts as one built in 2022. (Facts labelled `yfinance` there are those static estimates.) |
| `GET /api/replay` (Time machine) | No (historical by design) | Replays 3 Jan 2022 to Dec 2023 with `data_clock.get_prices(.., end)`. The frontend pauses the view in live mode and offers "Back to 3 Jan 2022". |
| `POST /api/proof` | **Partly** | The back-test runs from 2015 to the day before `sim_date`. In live mode that window grows to today, so verdicts can change (it now includes 2022 to 2026). The reproducible script moves with it. |
| `POST /api/ask` | **Partly** (new 2026-10-23) | Questions about the data itself ("do you have recent data?") are answered in code from the data clock. For "this week / today / latest price" questions the backend adds last close and 1-week change for the tickers asked about (default QQQ, VTI), via the data clock. Everything else uses the plan's facts, which are static (see row above). |
| `POST /api/agent/step` (Autopilot) | Yes | `engine/agent.py` reads prices up to `sim_date`. |
| Compare tab | No | Cached once after the first build (`lib/demo-prep.ts`); not rebuilt on Go live. |
| Plan already built before Go live | Unchanged | The plan is stored in the browser session; rebuild it to stamp the new date. |
| Header clock, Ask history, Proof, new plans | Use `clock.date` | They send the live date as `sim_date`. |

## What is never live

- **News, headlines, earnings, filings, analyst views:** not in the app at all.
- **Intraday or real-time prices:** only end-of-day closes (`Close`, not adjusted).
- **Individual company shares:** only the 17 ETFs (BIL SHY BND TIP VTI VXUS VT XLK XLC XLV XLP XLU XLE XLF XLI XLRE QQQ).
- **Sector weights inside each ETF:** hand-set estimates from end 2021 (`engine/exposure.py`), not refreshed.
- **Layoffs data:** a point-in-time mirror of layoffs.fyi, 2020-03-11 to 2023-03-06. Used for the pitch claim, not in any calculation.
- **FRED (CPI, T-bill):** local file, 2015 to Sep 2026; only shown in the Live market sheet.
- **The LLM:** explains in words; it is told the date range of the prices it has, and every number it writes is checked against facts.

## The Ask "no access" bug (fixed)

Cause: the model's instruction was "use ONLY the facts, otherwise say you don't know", and no fact described the app's own data, so
"do you have recent data?" was answered "I don't have access", even after Go live. A second cause of repetition: the engine emits one
`job_overlap` fact per sector ETF (nine identical facts); all nine were pasted into the prompt and all nine came back as `facts_used`.

Fix (`backend/ai/data_availability.py`, wired in `ai/functions.py` and the mock route): data questions are answered in code
(live: "Yes, daily closing prices for 17 ETFs up to <date> ... no news, earnings or intraday prices"; 2022 mode: "My data stops at the
simulation date on purpose ... press Go live"), the prompt now states what data exists and "state each fact at most once", and facts
are de-duplicated before prompt and response. In 2022 mode the answer does not reveal how far the price file extends.
Tests: `backend/tests/test_data_availability.py`.
