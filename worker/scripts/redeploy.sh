#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Kang Open Banking — Cloudflare Worker redeploy helper
# ----------------------------------------------------------------------------
# Required so the OAuth quickstart can complete E2E against the current spec:
# the live edge must serve the latest /openapi.json, /docs, and the public
# prefixes defined in worker/src/index.ts (PUBLIC_PREFIXES).
#
# Run locally OR from CI with a CLOUDFLARE_API_TOKEN secret:
#
#   cd worker
#   CLOUDFLARE_API_TOKEN=*** ./scripts/redeploy.sh           # production
#   CLOUDFLARE_API_TOKEN=*** ./scripts/redeploy.sh sandbox   # sandbox env
#
# After deploy, verify-deploy.sh probes /openapi.json, /docs, /v1/health on
# BOTH hostnames and fails non-zero if anything is gated or stale.
# ----------------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")/.."

ENV="${1:-production}"
echo "→ Deploying kob-gateway (env=$ENV)…"

if [ "$ENV" = "sandbox" ]; then
  npx --yes wrangler deploy --env sandbox
else
  npx --yes wrangler deploy
fi

echo "→ Verifying live edge…"
./scripts/verify-deploy.sh
echo "Redeploy complete."
