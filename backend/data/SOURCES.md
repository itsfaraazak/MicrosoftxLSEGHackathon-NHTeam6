# Data sources (provenance)

All files in this directory are plain CSVs read once at process start by `engine/data_clock.py`
(prices) or ad-hoc by scripts/routes (fred, layoffs). Nothing in the demo path calls a live API
except the opt-in `/api/live/refresh` endpoint (see `docs/api-contract.md` → "Live data").

| file | provider | URL | columns | rows | range | fetched_at | kind |
|---|---|---|---|---|---|---|---|
| `prices.csv` | yfinance (Yahoo Finance) | https://finance.yahoo.com (via `yfinance` Python package, `Close`, `auto_adjust=False`) | `Date`, then one column per ticker (17 ETFs: BIL,SHY,BND,TIP,VTI,VXUS,VT,XLK,XLC,XLV,XLP,XLU,XLE,XLF,XLI,XLRE,QQQ) | 2516 (base) → extended by `/api/live/refresh` | 2015-01-02 .. 2024-12-31 (base); extended to latest trading day when refreshed | 2026-10-23 (base download); refresh runs append more | real |
| `fred.csv` | FRED, Federal Reserve Bank of St. Louis | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCSL` and `?id=TB3MS` (public CSV export endpoint, no API key required) | `date`, `CPIAUCSL` (CPI, all urban consumers, index), `TB3MS` (3-month T-bill secondary market rate, %) | 141 | 2015-01-01 .. 2026-09-01 | 2026-10-23 14:32 | real |
| `layoffs.csv` | layoffs.fyi tracker, via public GitHub mirror `AlexTheAnalyst/MySQL-YouTube-Series/layoffs.csv` (a widely-used, unmodified export of the layoffs.fyi dataset; no auth required) | `https://raw.githubusercontent.com/AlexTheAnalyst/MySQL-YouTube-Series/main/layoffs.csv` | `company`, `location`, `industry`, `total_laid_off`, `percentage_laid_off`, `date`, `stage`, `country`, `funds_raised_millions` | 2361 | 2020-03-11 .. 2023-03-06 | 2026-10-23 14:33 | real |

## "150,000 tech workers in 2022" pitch-claim check

Computed from `layoffs.csv` (`total_laid_off`, grouped by year of `date`, nulls dropped):

| year | total_laid_off |
|---|---|
| 2020 | 81,068 |
| 2021 | 15,823 |
| **2022** | **161,711** |
| 2023 | 127,277 |

**Verdict: SUPPORTED.** The pitch line "In 2022, 150,000 tech workers lost their jobs" is conservative —
the tracked total for 2022 in this dataset is ~161,700, i.e. *higher* than the claimed 150,000. Keep the
150k figure as a safe, round, defensible lower bound in the pitch; do not round up to 161k without
re-checking against the live layoffs.fyi site (this is a point-in-time mirror, last updated ~March 2023,
so it does not capture any 2022 layoffs added to the tracker after that snapshot — if anything the true
number is >= 161,711, which still supports the claim).

## Notes
- No API keys were used or required for any of the above (FRED's `fredgraph.csv` export and the GitHub
  raw CSV mirror are both public, unauthenticated endpoints).
- `backend/mocks/*.json` are hand-written fixtures for frontend development against `USE_MOCKS=1`; they
  are not derived from any external source and are reported as `kind: mock` by `GET /api/data/sources`.
- Re-run everything with `backend/scripts/download_all.py`.
