# Project context (single source of truth — keep current)

## Pitch line
"In 2022, 150,000 tech workers lost their jobs and their savings in the same year. Your investments shouldn't bet on
the same thing your paycheck does."

## What it does
1. Builds a diversified $100k portfolio avoiding the client's job exposure. 2. Explains each choice with sourced numbers.
3. Answers questions (Ask). 4. Coaches through drops (Guard) instead of panic-selling. 5. Bonus: capped rule-bound Autopilot.
Novelty: standard questionnaires ask age/goals/comfort; we also ask what the job already exposes you to.

## Modules (code decides; LLM interprets/explains)
1 Profile builder (LLM parse + code validate) · 2 Exposure mapper (LLM maps job→sectors; code overlap) · 3 Portfolio builder (code only)
4 Explainer + number check · 5 Ask (should) · 6 Guard hold/sell coach (must) · 7 Autopilot (bonus)

## Allocation rules
1 Emergency fund first (<3 months cash → set aside). 2 Goals ≤5y → safe bucket (BIL/SHY/BND/TIP); rest growth.
3 Risk sets growth mix: low 40/60, med 60/40, high 80/20 shares/bonds; contradiction → step down one level.
4 Shares from sector ETFs + international; halve sectors in client ExposureMap, spread the rest.
5 Caps: no ETF >25%; flag employer shares >10% of investments. 6 Rebalance if drift >5pp.

## Guard rules
(1) Goal within 12 months and holding in growth → suggest safety. (2) Drop market-wide vs specific. (3) Cost of selling +
how long similar past drops (pre-sim-date) took to recover (6/12/24m). Client decides.

## Data (download once to CSV; no live APIs in demo)
yfinance Close 2015-01-01..2024-12-31; FRED CPIAUCSL, TB3MS; Kaggle layoffs; stretch: SEC EDGAR 10-K, Finnhub news.
ETFs — Safe: BIL SHY BND TIP · Broad: VTI VXUS VT · Sectors: XLK XLC XLV XLP XLU XLE XLF XLI XLRE · Compare only: QQQ.
Time machine: starts 2022-01-03, replay monthly to Dec 2023. Show the 2023 lag honestly.

## Shared objects
Profile{name,age,job_title,industry,employer,location,risk_tolerance,experience,emergency_fund_months,high_interest_debt,
past_behaviour,exclusions,contradictions,goals[],holdings[]} · Goal{name,amount_usd,years_away} · Holding{ticker,amount_usd,is_employer_stock}
ExposureMap{sectors,source} · Portfolio{sim_date,positions[],safe_bucket_usd,growth_bucket_usd,overlap_score}
Position{ticker,amount_usd,bucket,reason_facts[]} · Fact{id,value,unit,source,as_of} · GuardEvent{sim_date,drawdown_pct,market_wide,
cost_of_selling_usd,goal_years_away,suggested_action} · AgentAction{sim_date,ticker,trade_usd,rule_triggered,approved}

## Personas
Priya 29 fintech engineer (high risk stated, sold in 2020, $15k QQQ, $30k deposit in 5y) · Tom 41 NHS nurse (medium, never invested,
retire in 25y) · Fiona 35 offshore oil engineer Aberdeen (medium, employer shares, kids' education in 10y).

## Pitch (8 min + 2 Q&A): 01 client · 02 data · 03 what AI does (architecture slide: name the Azure services!) · 04+05 recommendation +
live demo · trust & limits (leak test, 2023 lag, FCA) · close. Round 1 judge is from Microsoft; top 3 per all rooms go to 17:00 final.
