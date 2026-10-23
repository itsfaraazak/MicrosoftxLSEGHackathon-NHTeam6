# Microsoft integration (the Round 1 judge is from Microsoft — name every service on the architecture slide)
| Service | Used for | Where | Status |
|---|---|---|---|
| Azure AI Foundry / Azure OpenAI | parse_profile, explain, ask, coach | backend/ai/llm.py (v1 endpoint, `AZURE_OPENAI_*`) | wire first |
| Azure Cosmos DB (NoSQL) | audit log, profiles, saved portfolios (JSON docs) | backend/db/store.py (`COSMOS_*`; falls back to local JSONL) | wire second |
| Application Insights (OpenTelemetry) | latency/errors/LLM call traces; show a trace in pitch | backend/app.py via azure-monitor-opentelemetry | stretch |
| Microsoft Entra ID (MSAL) | sign-in, "client identity" story | frontend msal-react | stretch |
| Azure Key Vault + DefaultAzureCredential | secrets story for "what a real launch needs" | backend | slide-only unless time |
| Azure Content Safety / Prompt Shields | prompt-injection guardrail | backend/ai | stretch (pairs with AI-security coach) |
Rule: the demo must still run offline on mocks/CSVs. Azure is the intelligence + audit layer, not a demo-day single point of failure.
Credentials: ask the team lead for the team-06 values; endpoint/deployment name come from the Azure portal or the coaches (Microsoft Cloud Solution Architects).
