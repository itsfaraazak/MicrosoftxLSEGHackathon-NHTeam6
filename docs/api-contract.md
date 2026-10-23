# API contract (frontend ↔ backend). JSON in/out. Mocks: backend/mocks/<endpoint>.json. Change only by 3-way agreement.
| Endpoint | Sends | Returns | Owner |
|---|---|---|---|
| POST /api/profile/parse | {text} | {profile, contradictions} | route P2, fn P3 |
| POST /api/portfolio | {profile, sim_date} | {portfolio, explanation, facts} | P2; explanation P3 |
| POST /api/compare | {profiles, sim_date} | {portfolios[]} | P2 |
| GET /api/replay | profile_id, from, to | {months[{date,ours,tech_heavy}], events[GuardEvent+coach_message]} | P2; coach P3 |
| POST /api/ask | {question, profile, sim_date} | {answer, facts_used} | P3 |
| POST /api/agent/step (bonus) | {portfolio, sim_date} | {trades, rule_triggered} | P2 |
| GET /api/health | – | {ok, mocks} | – |
Types: frontend/lib/api.ts. Switch frontend to real backend = NEXT_PUBLIC_API_URL; switch backend off mocks = USE_MOCKS=0.
