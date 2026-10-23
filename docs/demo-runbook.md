# Demo runbook (frontend, P1)

## Start it (two terminals)
```bash
# 1. Backend in mock mode (port 5001 because macOS AirPlay Receiver owns 5000)
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt     # first time only
USE_MOCKS=1 FLASK_PORT=5001 .venv/bin/python app.py

# 2. Frontend (the demo-safest way: production build, env vars are baked in at build time)
cd frontend
npm ci                                  # first time only
npm run sync-mocks                      # copies backend/mocks/*.json to public/demo for the offline fallback
NEXT_PUBLIC_API_URL=http://localhost:5001 NEXT_PUBLIC_DEMO_FALLBACK=1 npm run build
npm start -- -p 3000                    # open http://localhost:3000 at 1920x1080, browser zoom 100%
```
Dev mode works too: `NEXT_PUBLIC_API_URL=http://localhost:5001 NEXT_PUBLIC_DEMO_FALLBACK=1 npm run dev`.
Live backend later: `USE_MOCKS=0` on Flask, nothing to change in the frontend.

## Pre-demo checklist
- [ ] AirPlay Receiver off (System Settings → General → AirDrop & Handoff) **or** use port 5001 as above.
- [ ] Run `npm run dev` or `npm run build` once on good Wi-Fi so Unbounded and Manrope download. Offline, the UI falls back to system fonts and still works.
- [ ] `npm run sync-mocks` done (otherwise the offline fallback has nothing to load).
- [ ] Top-right badge says **Mock data** (or **Live data** once P2/P3 are live). Fix anything else first.
- [ ] Do one full run, then press **Shift+R** so you start clean. Compare stays pre-cached after a reset.
- [ ] Notifications off, window fullscreen, backup video open in another window: `materials/demo-backup.webm`.

## Keyboard
| Keys | Where | Does |
|---|---|---|
| ← → | anywhere | previous / next view |
| 1 2 3 4 | anywhere | Profile / Portfolio / Time machine / Ask |
| N · B · R | Time machine | next month · previous month · back to 3 Jan 2022 |
| Shift+R | anywhere | Reset demo: clears this session (profile, plan, persona, replay cursor, Ask history), back to Profile. Keeps the Compare cache. |
Not built (cut for time): the `?` shortcuts panel, P persona cycle, a "Clear all caches" button. To clear everything, clear site data for localhost in the browser.

## If the backend dies mid-demo
- With `NEXT_PUBLIC_DEMO_FALLBACK=1` (set above): the next request loads the saved demo responses, the badge turns gold **Offline demo data**, and the flow continues. Say "these are saved demo responses", not "live".
- Screens already loaded keep working: the replay is fetched once and revealed month by month.
- Without the flag: badge shows **Backend offline** with Retry. Restart Flask, press Retry.
- Last resort: play `materials/demo-backup.webm`.

## Click path (about 4 minutes)
1. **Profile** – Priya is selected. "Read my answers" → review card: point at the gold callout (said high risk, sold in 2020).
2. "Build my $100,000 plan" → orbit swings to **Portfolio**. Overlap rings: savings vs paycheck. Click VTI to show its facts with source and date.
3. **How this was decided** → every Fact, grouped by source.
4. **Compare people** → same $100,000, three lives. (On mocks the three cards have identical numbers; say "preview data".)
5. Press **3** → **Time machine**. Press **N** five times to June 2022. The coach card swings in. Click "I still want to sell" to show it only acknowledges. Mention the hidden future (hatched zone).
6. Press **4** → **Ask** → "What happens to tech stocks in 2022?" (leak test). The answer shows "Answer uses data up to <date>"; the date follows the replay cursor.
7. Close: not financial advice, paper money, LSEG-style provenance on every number.

## Known mock quirks (don't be surprised)
Parse always returns Priya; compare returns three identical portfolios; replay starts 1 Jan 2022 in the data (the clock shows 3 Jan at the start); the Ask mock returns the same sentence for any question; the 2023 "tech overtook you" note only appears if the API data actually shows it.
