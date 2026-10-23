# Deploy: phone-accessible demo

Judges open **one URL on their phones**. The frontend is static/SSR on Vercel;
the backend stays on the laptop, reached through an ngrok tunnel. Vercel
never exposes the ngrok URL to the browser — everything goes through the
Vercel origin.

## Architecture

```
 Judge's phone (Safari)
        |
        |  https://dont-double-down-t6.vercel.app/...
        v
 Vercel (Next.js app, static + SSR)
        |
        |  same request to /ask, /profile, etc. -> rendered by Next.js
        |
        |  /api/*  -> intercepted by frontend/middleware.ts
        v
 middleware.ts (Vercel Edge "Proxy" function)
        |  server-side fetch() to the backend, with the header
        |  `ngrok-skip-browser-warning: true` added (see "The ngrok
        |  interstitial" below) and the phone's original method/body
        |  forwarded 1:1. Response is streamed back unmodified.
        v
 https://superbowl-jalapeno-mower.ngrok-free.dev/api/*   (ngrok tunnel)
        |
        v
 http://localhost:5070/api/*   (gunicorn, real mode, on the laptop)
```

The phone only ever sees `https://dont-double-down-t6.vercel.app`. It never
sees the ngrok URL or `localhost`.

## URLs

- **Public judge URL:** https://dont-double-down-t6.vercel.app
- **Vercel project:** `faraazs-projects-98286cae/dont-double-down-t6`
- **ngrok tunnel:** https://superbowl-jalapeno-mower.ngrok-free.dev -> `http://localhost:5070`
- **Backend:** gunicorn, `app:app`, port **5070** (never 5060/5061 — Chrome blocks those ports)

## The ngrok interstitial (important — read before touching the proxy)

ngrok's free tier shows an HTML "You are about to visit..." interstitial
page to any request that looks like it came from a browser, UNLESS the
request carries the header `ngrok-skip-browser-warning`. This is enforced
at ngrok's cloud edge, **before** the local ngrok agent (and before any
`--traffic-policy-file` you configure locally) ever sees the request — we
verified this by running a traffic policy with an `add-headers` action and
confirming it had no effect. A `vercel.json` `rewrites` entry has no way to
inject a custom header into the proxied request either (Vercel's `headers`
config only sets headers on the response Vercel sends to the client, not on
requests Vercel makes to a rewrite destination).

**That's why `frontend/middleware.ts` exists.** It intercepts `/api/*`
itself and does a manual `fetch()` to the ngrok URL with
`ngrok-skip-browser-warning: true` set, then streams the response back. This
was the one deviation from the original plan of "vercel.json rewrites only"
— it was required to make the one-origin proxy actually work from a real
phone browser. `frontend/vercel.json` is intentionally near-empty (`{}`).

If you ever need to restart ngrok, you do **not** need `--traffic-policy-file`
or `--request-header-add` (neither is required now that middleware.ts
handles the header) — just keep the same domain:

```
ngrok http 5070 --log=stdout --url superbowl-jalapeno-mower.ngrok-free.dev
```

## Restarting things

### Backend (gunicorn on 5070)

```bash
cd backend
.venv/bin/gunicorn -w 2 --threads 4 --timeout 60 -b 0.0.0.0:5070 -b [::]:5070 app:app
```

Check it's alive: `curl http://localhost:5070/api/health` should return
`{"mocks":false,"ok":true}`.

### ngrok tunnel

```bash
ngrok http 5070 --log=stdout --url superbowl-jalapeno-mower.ngrok-free.dev
```

Verify the domain came back the same:

```bash
curl -s http://127.0.0.1:4040/api/tunnels
```

### Frontend (redeploy to Vercel)

On the machine whose Vercel account owns `faraazs-projects-98286cae/dont-double-down-t6`:

```bash
cd frontend
./scripts/deploy-spark.sh              # tsc + lint + build, sync demo data, log in/link if needed, deploy to production, smoke-test
./scripts/deploy-spark.sh --preview    # same, but a preview URL instead of production
```

It pins the Vercel CLI (`VERCEL_CLI_VERSION`, default 65.2.0) and never reads `.env` files. The older
`./scripts/deploy.sh` still works if the folder is already linked and you are logged in.

This is idempotent — re-run it any time after a frontend change. It syncs
demo mocks (if the `sync-mocks` npm script exists) and runs
`vercel deploy --prod --yes`.

## Keeping the laptop alive for the demo

- **Don't let it sleep:** `caffeinate -dimsu &` (run once, leave it running;
  `pkill caffeinate` to stop).
- **Stay on the venue Wi-Fi**, not a personal hotspot — if the laptop's IP
  changes, the ngrok tunnel itself keeps working (ngrok reconnects through
  whatever network path is live), but confirm `curl http://localhost:5070/api/health`
  still works after any network switch.
- Keep the terminal running gunicorn and the terminal running ngrok both
  open and not asleep. Don't close the lid without caffeinate running — macOS
  will suspend background processes on lid-close even with caffeinate in
  some configurations, so prefer keeping the lid open and the display dimmed
  instead of trusting caffeinate alone through a clamshell close.

## 60-second pre-demo checklist

1. `curl -s http://localhost:5070/api/health` → `{"mocks":false,"ok":true}`
2. `curl -s http://127.0.0.1:4040/api/tunnels` → confirm `public_url` is
   still `https://superbowl-jalapeno-mower.ngrok-free.dev`
3. `curl -s https://dont-double-down-t6.vercel.app/api/health` → `{"mocks":false,"ok":true}`
   (this is the full chain: Vercel -> middleware -> ngrok -> backend)
4. Open `https://dont-double-down-t6.vercel.app` on your own phone, on the
   venue Wi-Fi (not your laptop's hotspot), and check the "Backend
   connected" pill is green on the home page.
5. Ask one real question on `/ask` and confirm you get an answer within
   ~20 seconds.
6. Make sure `caffeinate -dimsu` is running and the laptop lid is open.

## What judges see if the laptop drops

The frontend has `NEXT_PUBLIC_DEMO_FALLBACK=1` set in production. If the
ngrok tunnel or the backend goes down mid-demo, the app's own fallback logic
switches to the bundled JSON fixtures under `frontend/public/demo/` instead
of live backend calls, so the UI keeps working on canned data rather than
showing errors. This is a feature already built into the frontend (see
`frontend/lib/flags.ts`); this deploy only turns the flag on for production.
**Known gap:** `frontend/public/demo/` currently only has `proof.json` — no
`sync-mocks` npm script exists in `frontend/package.json` to generate the
rest (ask/replay/health fixtures), so the demo fallback is only as complete
as whatever is already checked into `public/demo/`. Whoever owns the demo
fallback should check that directory covers every route used in the demo
flow before relying on it as a safety net.

## QR code for judges

`qrencode` isn't installed on this laptop. To make a scannable QR code for
the URL, either:

- Install it: `brew install qrencode`, then
  `qrencode -o qr.png "https://dont-double-down-t6.vercel.app"`
- Or just use any phone's camera app pointed at a QR code generated by a
  site like `qr-code-generator.com` for the same URL — no install needed,
  works in a browser on the demo laptop.

## Rate limits and the kill switch

- The LLM routes (`/api/ask`, `/api/profile/parse`, etc.) are rate-limited
  to **60 requests/min/IP** on the backend. A room full of judges hammering
  `/ask` at once could hit this — if you see 429s, that's why.
- **Security note:** this public Vercel URL proxies straight through to a
  backend holding a real (team) LLM API key. The GitHub repo is public and
  the Vercel env vars are all `NEXT_PUBLIC_*` (visible to anyone), but the
  LLM key itself only ever lives in `backend/.env` on the laptop and is
  never sent to Vercel. Still, **stop the tunnel as soon as judging is
  over** — anyone with the ngrok URL (easily discoverable by inspecting
  `/api/*` network calls from the public site) can hit the backend directly
  and burn through the rate limit / the team's LLM budget. Kill switch:

  ```bash
  pkill ngrok
  ```

  The Vercel site will keep loading (static UI) but all `/api/*` calls will
  fail — the `NEXT_PUBLIC_DEMO_FALLBACK=1` flag means the UI should fall
  back to demo data rather than breaking outright (see the known gap in
  mock coverage above).

## Known issues / what's left

- **(Fixed 2026-10-23) Mobile layout.** The overflow/clipping below was caused by a header that wrapped into several rows plus a
  tour bar, a dock and a footer that left ~60px for the page. The app is now a slim top bar, one full-height panel and a bottom tab
  bar on phones. Original report kept for history:
- **Mobile layout overflow.** Headless-Chrome screenshots at 390x844
  (iPhone viewport) of `/` and `/ask` both show horizontal clipping: the
  simulation-date banner, suggestion chips (e.g. "Why is my deposit in
  Treasu…"), and the footer disclaimer all run past the right edge of the
  screen with no visible wrap/scroll affordance. Something in the top
  banner / chip row is forcing a width wider than the viewport. Worth a
  look by whoever owns `frontend/app` / `frontend/components` — likely a
  flex row without `flex-wrap` or a fixed-width element in the header
  banner component. Not fixed here since this task's scope excluded
  editing `frontend/app`, `frontend/components`, `frontend/lib`.
- **`sync-mocks` script doesn't exist** in `frontend/package.json` (the
  original plan assumed it did). `deploy.sh` checks for it and skips
  gracefully if absent. `frontend/public/demo/` only has `proof.json` today.
- Env var `NEXT_PUBLIC_API_URL` is set to an **empty string** in Vercel
  production (not unset) so that `lib/api.ts`'s
  `process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000'` resolves to
  `""` (falls through to relative `/api/...` calls on the same origin) —
  `??` only falls back on `null`/`undefined`, not on `""`, so this works as
  intended, but it's a slightly fragile line to be aware of if that
  fallback logic ever changes.
