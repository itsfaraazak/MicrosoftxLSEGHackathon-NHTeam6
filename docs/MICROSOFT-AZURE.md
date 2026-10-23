# Microsoft and Azure in SPARK: what is really used

Audited 2026-10-23 from the code on branch `faraaz` (not from slides). The real `.env` files were **not** opened (repo policy), so
anything that depends on a secret or a base URL is marked "unverified here". Same table is shown in the app at `/how-it-works`.

## At a glance

| Service | Status | What it does for SPARK | Evidence |
|---|---|---|---|
| **LLM on the organisers' Azure-hosted OpenAI-style portal** | **Wired and used** (team docs report real calls) | Parses your free text, maps your job to sectors, explains the plan, answers Ask, writes coach messages. Never picks holdings, never sees raw prices. | `backend/ai/llm.py` (OpenAI client; Azure `deployments` route + `api-key` header when `LLM_API_VERSION` is set); `docs/pitch/SLIDE-ANSWERS.md:15` ("hosted on Azure App Service"); `docs/context/AZURE.md` §1 (portal host `app-uoaihack2ix6ak.azurewebsites.net`). Unverified here: the actual `LLM_BASE_URL` and model name come from env vars. |
| Azure OpenAI / AI Foundry (our own deployment) | **Not used** (code can talk to one) | Nothing today. The client accepts `AZURE_OPENAI_ENDPOINT/API_KEY/DEPLOYMENT` as a fallback, but we have no subscription resource. | `backend/ai/llm.py` `_settings()` |
| Azure Cosmos DB | **Optional, off by default** | Would hold the audit log. Without `COSMOS_ENDPOINT` + `COSMOS_KEY` the same log is a local file. | `backend/db/store.py:13-31`; a local `backend/data/local_store.jsonl` exists with real events, so the file path is what runs here. `docs/pitch/SLIDE-ANSWERS.md:117`: "not wired". |
| Application Insights / Azure Monitor | **In dependencies, not wired** | Nothing. Our own "rigor" metadata (per-request steps, timings, number-check results) and the audit log stand in. | `azure-monitor-opentelemetry` in `backend/requirements.txt`; `@microsoft/applicationinsights-web` in `frontend/package.json`; no import anywhere. |
| Azure Identity (`azure-identity`) | **In dependencies, not wired** | Nothing. | `backend/requirements.txt`; no import anywhere. |
| Entra ID / MSAL (`@azure/msal-browser`, `@azure/msal-react`) | **In dependencies, not wired** | Nothing. There is no sign-in in the app. | `frontend/package.json`; no import anywhere. |
| GitHub (owned by Microsoft) | **Used (dev tooling)** | Hosts the repo, branches and pull requests. | `git remote -v` -> `github.com/itsfaraazak/MicrosoftxLSEGHackathon-NHTeam6` |
| TypeScript (created by Microsoft) | **Used** | The whole frontend is strict TypeScript. | `frontend/tsconfig.json` (`"strict": true`), `frontend/**/*.ts(x)` |
| VS Code | **Dev tooling only** | The editor the team built it in (Claude Code runs as a VS Code extension). Not part of the product. | n/a |

**Not Microsoft** (so don't put them on a Microsoft slide): Vercel (frontend hosting), ngrok (tunnel to the laptop), Next.js, Flask/Python,
yfinance/Yahoo Finance, FRED, layoffs.fyi.

## What we can honestly say on stage

1. "The AI parts (reading your life story, mapping your job to sectors, explaining the plan, answering questions, coaching messages) run on the organisers' Azure-hosted OpenAI portal."
2. "The AI never chooses your investments: plain code does, and every number the AI writes is checked against facts the code produced."
3. "The app is a Next.js and TypeScript frontend and a Flask backend, built on GitHub."
4. "Every AI action is written to an append-only audit log; the store has a Cosmos DB client built in, but today it writes to a local file."
5. "The next step for production is moving to Azure services (below); we have not done that yet."

## Do not claim

- **Cosmos DB** as live ("our audit log is in Cosmos") unless `COSMOS_*` is set on the demo machine and you have seen an item appear in the portal.
- **Application Insights, Entra ID sign-in, Azure Identity, Key Vault, Content Safety / Prompt Shields**: none is wired. The packages in `requirements.txt` / `package.json` are unused.
- **"Deployed on Azure"** or "our Azure OpenAI resource": the frontend is on Vercel, the backend runs on a laptop behind ngrok, and the model is the organisers' portal, not our deployment.

## What Azure would add next (future, not built)

- Host the backend on **Azure App Service / Container Apps** and the frontend on **Static Web Apps**, replacing the laptop + ngrok + Vercel chain.
- Turn on the **Cosmos DB** audit store (client already in `db/store.py`) and keep the LLM key in **Key Vault**.
- Wire **Application Insights** through `azure-monitor-opentelemetry` (already a dependency) for traces and latency.
- **Entra ID** sign-in so each person's plans are theirs alone.
- **Azure AI Content Safety / Prompt Shields** as a second layer behind our regex guardrails (`ai/guardrails.py`).
- Our own **Azure OpenAI** deployment with content-filter and quota settings we control.
