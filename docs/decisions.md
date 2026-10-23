# Decision log (append; newest last). Format: date · decision · why · who
- 2026-10-23 · Azure (Cosmos DB + AI Foundry/OpenAI) instead of Supabase · Microsoft hackathon, Round 1 judge from Microsoft; JSON docs fit Profile/Portfolio/Fact + audit log · team
- 2026-10-23 · DB layer falls back to local JSONL when COSMOS_* unset · demo must survive bad Wi-Fi / unprovisioned DB · scaffold
- 2026-10-23 · Git-committed docs are the shared Claude context (no external tool) · zero setup for every teammate · team
- 2026-10-23 · Frontend work lives on branch `bipin-frontend` (not `p1/frontend`) · branch already created; one name for the whole day · P1
- 2026-10-23 · Frontend validates every response with zod and degrades per section (core fields strict, enhancement fields optional) · teammates' backends will drift during the day; demo must not white-screen · P1
