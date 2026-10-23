# Microsoft integration (Round 1 judge is from Microsoft) - zero-cost plan, researched Oct 2026
Rule: the demo must still run offline on mocks/CSVs. Azure is the intelligence + audit layer, not a demo-day single point of failure.
Freeze 14:45, now ~14:00: only do items marked DO. Everything else is slide-free/"roadmap" wording.

## 1. Reality check (what we actually have)
- We have: organizer OpenAI-style portal `https://app-uoaihack2ix6ak.azurewebsites.net` (Blazor "UOOpenAIPortal", login page) + team-06 credentials from the team lead. API shape UNKNOWN: a Blazor login is a UI, not necessarily an API. Ask a coach for: base URL, auth header (Bearer vs `api-key`), model/deployment name, `/v1/chat/completions` or Azure `/openai/deployments/...`.
- We may have NO Azure subscription and a hackathon sandbox may block resource creation. Assume none until a coach confirms. Anything below that says "needs subscription" is then unavailable.
- Creating resources can bill. Do not create anything you cannot delete in 2 minutes; never click past a card prompt.
- Azure OpenAI / AI Foundry model calls are NOT free (pay per token). We only use the organizer portal, which is free to us.

## 2. Recommended free-and-fast set, ranked by value per minute
| # | Service | Free limit | Zero-charge way | Setup | Worth it by 14:45? | Pitch wording |
|---|---|---|---|---|---|---|
| 1 | Organizer OpenAI portal (Azure-hosted) | team-06 quota, no cost to us | no subscription needed | 5-10 (blocked on API shape) | DO, it is the AI core | "LLM served via Azure OpenAI portal" only once a real call works |
| 2 | Cosmos DB emulator (Docker) | free, local, no subscription ([docs](https://learn.microsoft.com/azure/cosmos-db/emulator)) | `COSMOS_*` pointed at `localhost:8081` + well-known key | 10-15 | MAYBE. Linux emulator may not run on Apple silicon (same docs); else JSONL fallback | "Cosmos DB-ready store (NoSQL JSON docs), runs against the emulator" |
| 3 | Cosmos DB free tier | 1000 RU/s + 25 GB, lifetime, 1 per subscription, opt-in at create, not serverless ([docs](https://learn.microsoft.com/azure/cosmos-db/free-tier)) | tick "Apply Free Tier Discount"; stay under 1000 RU/s | 10 | ONLY if a subscription exists; else skip | "Audit log in Azure Cosmos DB" only if live |
| 4 | Entra ID + MSAL | Free edition of tenant is included; basic SSO/MSAL needs an app registration | needs a tenant you can register apps in; sandbox often blocks | 20-30 | NO for freeze; mock "sign in as client" | "Entra ID sign-in is on the roadmap" |
| 5 | Prompt Shields (Content Safety) | F0 about 5,000 text records/month (1 record = 1,000 chars) ([pricing](https://azure.microsoft.com/en-us/pricing/details/content-safety/)); verify F0 row | needs subscription resource; F0 caps, no overage | 15-20 | NO. Use our local regex/heuristic injection filter and say so | "Layered prompt-injection guard; Prompt Shields is the planned upgrade" |
| 6 | App Insights / Azure Monitor | first 5 GB/month ingestion free ([Q&A](https://learn.microsoft.com/en-us/answers/questions/349683/application-insights-pricing)); over that about $2.30/GB | set daily cap 0.16 GB; needs subscription | 15 | NO. Log own trace IDs in the JSON audit log instead | "OpenTelemetry-style trace IDs in audit log; App Insights export planned" |
| 7 | Static Web Apps Free | 250 MB/app, 2 custom domains, no SLA ([docs](https://learn.microsoft.com/azure/static-web-apps/plans)) | GitHub deploy; needs subscription | 20 | NO. Demo from localhost | only if deployed |

## 3. Do-not-use list (this hackathon)
- Azure OpenAI / AI Foundry own deployments: pay-per-token, needs subscription + quota approval.
- Key Vault: pay per 10k operations, no meaningful free grant ([pricing](https://azure.microsoft.com/en-us/pricing/details/key-vault/)); use `.env` (never committed) and say "Key Vault for production".
- App Service F1: shared CPU quota, cold starts, 1 GB, not demo-safe ([quotas](https://learn.microsoft.com/azure/app-service/web-sites-monitor)); localhost is safer.
- Functions Consumption (about 1M executions free, third-party figure): needs a storage account; no benefit for Flask.
- Table Storage/Blob: needs a storage account (billed); JSONL is enough.
- "Try Cosmos DB free" sandbox ([docs](https://learn.microsoft.com/azure/cosmos-db/try-free)): no subscription needed but 30 days, 1 container, 10 GB; free and zero risk, yet data expires and it adds a login step. Use only if the emulator fails and we want a real cloud endpoint.
- Azure free account ($200 credit, 30 days) ([page](https://azure.microsoft.com/en-us/pricing/free-services/)): needs card; students may get $100 credit with academic email, no card. Do not sign up now.
- GitHub Copilot Free: dev tool only, not a runtime service; do not put it on the architecture slide.

## 4. Env vars and fallback behaviour already in code
- `backend/ai/llm.py`: reads `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, or `AZURE_OPENAI_*` (endpoint/key/deployment, v1 endpoint). With none set it uses the offline mock.
- `backend/db/store.py`: uses `COSMOS_*` (endpoint, key, database, container) when all set; when unset it falls back to local JSONL (audit log + profiles).
- Emulator values: endpoint `https://localhost:8081/`, key is the public well-known emulator key from the docs above (not a secret; never paste real keys in this file). Python SDK needs the emulator cert trusted.
- Check on stage: `GET /health` or log line should show which backend is active (llm: portal/mock, store: cosmos/jsonl).

## 5. Pitch wording (claim only what is wired)
- Wired and live: "Flask + Next.js app; LLM calls via the organizer's Azure-hosted OpenAI portal" (say only after a real call succeeds).
- Wired locally: "Every AI action is written to an append-only JSON audit log with trace IDs" (JSONL today; Cosmos DB when `COSMOS_*` is set).
- Wired locally: "Prompt-injection guard + refusal tests (/leak-test)". Name Prompt Shields only as "next step".
- Roadmap line, labelled as such: "Cosmos DB, Application Insights, Entra ID, Key Vault, Content Safety for a production launch."
- Never say "deployed on Azure", "uses Entra", or "App Insights" unless it is demoed.
- Credentials: ask the team lead for team-06 values; coaches (Microsoft Cloud Solution Architects) can confirm the API shape.
