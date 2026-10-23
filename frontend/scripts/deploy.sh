#!/usr/bin/env bash
# Idempotent redeploy of the frontend to Vercel production.
# Safe to re-run any time: it just rebuilds and re-publishes the same
# project/env vars that are already configured in Vercel.
#
# Usage: ./scripts/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f package.json ] && grep -q '"sync-mocks"' package.json; then
  echo "==> Syncing demo mock data..."
  npm run sync-mocks
else
  echo "==> No sync-mocks script found, skipping (demo fallback uses whatever is in public/demo/)."
fi

echo "==> Deploying to Vercel production..."
OUTPUT="$(vercel deploy --prod --yes)"
echo "$OUTPUT"

URL="$(echo "$OUTPUT" | grep -Eo 'https://[a-zA-Z0-9.-]+\.vercel\.app' | tail -1)"
echo ""
echo "==> Production URL: ${URL:-<check output above>}"
echo "==> Quick checks:"
echo "    curl -s \$URL/api/health"
echo "    open \$URL"
