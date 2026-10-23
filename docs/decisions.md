# Decision log (append; newest last). Format: date · decision · why · who
- 2026-10-23 · Azure (Cosmos DB + AI Foundry/OpenAI) instead of Supabase · Microsoft hackathon, Round 1 judge from Microsoft; JSON docs fit Profile/Portfolio/Fact + audit log · team
- 2026-10-23 · DB layer falls back to local JSONL when COSMOS_* unset · demo must survive bad Wi-Fi / unprovisioned DB · scaffold
- 2026-10-23 · Git-committed docs are the shared Claude context (no external tool) · zero setup for every teammate · team
- 2026-10-23 · Contract additions (optional): Position.reason, Portfolio.baseline_overlap_score; LLM endpoints fail fast with {"error","fallback":true} 504/502 (parse keeps 422); /api/ask accepts profile=null · frontend owner request; mocks updated same commit · B
- 2026-10-23 · LLM client is provider-flexible (LLM_BASE_URL/LLM_API_KEY/LLM_MODEL, AZURE_OPENAI_* fallback). Organizer portal is a Blazor login page, API shape unknown; no extra Azure resources unless free and subscription exists (docs/context/AZURE.md) · B
