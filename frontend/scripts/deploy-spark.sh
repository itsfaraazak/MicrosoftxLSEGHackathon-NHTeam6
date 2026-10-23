#!/usr/bin/env bash
# One-command production deploy of SPARK to Vercel. Meant for Faraaz's machine, which owns the Vercel team.
#
#   cd frontend && ./scripts/deploy-spark.sh            # checks, then deploys to production
#   ./scripts/deploy-spark.sh --preview                 # deploy a preview URL instead of production
#   ./scripts/deploy-spark.sh --skip-checks             # skip tsc/lint/build (use when you just ran them)
#
# What it does, in order: checks tools -> installs deps if missing -> tsc + lint + build -> syncs the
# offline demo data -> logs in to Vercel if needed -> links this folder to the project -> deploys -> smoke-tests.
# It never reads .env files and never prints secrets. Safe to re-run.
#
# Override defaults with env vars: VERCEL_SCOPE, VERCEL_PROJECT, VERCEL_CLI_VERSION, SITE_URL.
set -euo pipefail

SCOPE="${VERCEL_SCOPE:-faraazs-projects-98286cae}"
PROJECT="${VERCEL_PROJECT:-dont-double-down-t6}"
SITE_URL="${SITE_URL:-https://dont-double-down-t6.vercel.app}"
CLI_VERSION="${VERCEL_CLI_VERSION:-65.2.0}"

PREVIEW=0
SKIP_CHECKS=0
for arg in "$@"; do
  case "$arg" in
    --preview) PREVIEW=1 ;;
    --skip-checks) SKIP_CHECKS=1 ;;
    -h|--help) sed -n 2,12p "$0"; exit 0 ;;
    *) echo "Unknown option: $arg (try --help)"; exit 2 ;;
  esac
done

cd "$(dirname "$0")/.."
say() { printf '\n==> %s\n' "$*"; }
die() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

say "Checking tools"
command -v node >/dev/null || die "node is not installed (need Node 20+). Install from https://nodejs.org"
command -v npm  >/dev/null || die "npm is not installed"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || die "Node $NODE_MAJOR is too old; need 20 or newer"
command -v curl >/dev/null || die "curl is not installed"

# Use a globally installed `vercel` if present, else fetch the pinned version on demand.
if command -v vercel >/dev/null 2>&1; then
  VERCEL=(vercel)
else
  VERCEL=(npx --yes "vercel@${CLI_VERSION}")
fi
echo "Using: ${VERCEL[*]}"

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
echo "Git branch: $BRANCH"
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "WARNING: you have uncommitted changes. The deploy uses your working tree as it is right now."
fi

if [ ! -d node_modules ]; then
  say "Installing dependencies (npm ci)"
  npm ci
fi

if [ "$SKIP_CHECKS" -eq 0 ]; then
  say "Type check"
  npx tsc --noEmit
  say "Lint"
  npm run lint
  say "Production build (catches errors that dev mode misses)"
  npm run build
else
  say "Skipping checks (--skip-checks)"
fi

say "Syncing the offline demo data into public/demo"
if grep -q '"sync-mocks"' package.json; then
  npm run sync-mocks
else
  echo "No sync-mocks script; using whatever is already in public/demo."
fi

say "Checking Vercel login"
if ! "${VERCEL[@]}" whoami >/dev/null 2>&1; then
  echo "Not logged in. A browser window (or a code prompt) will open to log in to Vercel."
  "${VERCEL[@]}" login
fi
echo "Logged in as: $("${VERCEL[@]}" whoami 2>/dev/null | tail -1)"

if [ ! -f .vercel/project.json ]; then
  say "Linking this folder to Vercel project ${SCOPE}/${PROJECT}"
  "${VERCEL[@]}" link --yes --scope "$SCOPE" --project "$PROJECT"
fi

if [ "$PREVIEW" -eq 1 ]; then
  say "Deploying a PREVIEW"
  OUTPUT="$("${VERCEL[@]}" deploy --yes --scope "$SCOPE")"
else
  say "Deploying to PRODUCTION"
  OUTPUT="$("${VERCEL[@]}" deploy --prod --yes --scope "$SCOPE")"
fi
echo "$OUTPUT"
DEPLOY_URL="$(echo "$OUTPUT" | grep -Eo 'https://[a-zA-Z0-9.-]+\.vercel\.app' | tail -1 || true)"
[ -n "$DEPLOY_URL" ] || die "Deploy finished but no URL was found in the output above."
CHECK_URL="$DEPLOY_URL"
[ "$PREVIEW" -eq 0 ] && CHECK_URL="$SITE_URL"

say "Smoke tests against $CHECK_URL"
sleep 4
CODE="$(curl -s -o /dev/null -w '%{http_code}' -L "$CHECK_URL" || echo 000)"
if [ "$CODE" = "200" ]; then echo "PASS  home page answers 200"; else echo "FAIL  home page answered $CODE"; fi
if curl -s -L "$CHECK_URL" | grep -qi "SPARK"; then echo "PASS  page mentions SPARK"; else echo "WARN  page does not mention SPARK yet (CDN may still be updating; reload in a minute)"; fi
HEALTH="$(curl -s -m 10 -L "$CHECK_URL/api/health" || true)"
case "$HEALTH" in
  *'"ok"'*) echo "PASS  backend reachable through the proxy: $(echo "$HEALTH" | tr -d '\n ')" ;;
  *) echo "WARN  /api/health did not answer through the proxy. The site still works on saved demo data,"
     echo "      but for live answers start the backend and the tunnel (see docs/DEPLOY.md)." ;;
esac

say "Done"
echo "Deployed:   $DEPLOY_URL"
echo "Public URL: $SITE_URL"
echo
echo "Before judges arrive: caffeinate -dimsu; start gunicorn (port 5070) and ngrok; run backend/scripts/prewarm.py;"
echo "open the public URL on a real phone and check the 'Backend connected' pill."
