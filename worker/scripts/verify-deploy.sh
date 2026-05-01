#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Kang Open Banking — Post-Deploy Gateway Health Verification
# ----------------------------------------------------------------------------
# Verifies that both production and sandbox hostnames are bound to the
# `kob-gateway` Cloudflare Worker AND that public paths (PUBLIC_PREFIXES in
# worker/src/index.ts) are reachable WITHOUT an API key.
#
# Run after every `npx wrangler deploy`:
#
#   ./scripts/verify-deploy.sh
#   PROD=https://api.kangopenbanking.com SANDBOX=https://sandbox-api.kangopenbanking.com \
#     ./scripts/verify-deploy.sh
#
# Exit code is non-zero if ANY check fails — wire into CI to block bad deploys.
# ----------------------------------------------------------------------------
set -uo pipefail

PROD="${PROD:-https://api.kangopenbanking.com}"
SANDBOX="${SANDBOX:-https://sandbox-api.kangopenbanking.com}"
EXPECTED_SERVED_BY="kob-edge-gateway"
EXPECTED_PROJECT_REF="wdzkzeahdtxlynetndqw"

FAILED=0
pass() { printf "  \033[32m✓\033[0m %s\n" "$1"; }
fail() { printf "  \033[31m✗\033[0m %s\n" "$1"; FAILED=1; }
hr()   { printf -- "----------------------------------------------------------------------\n"; }

# check_endpoint <label> <url> <expected_status> <expected_env>
check_endpoint() {
  local label="$1" url="$2" want_status="$3" want_env="$4"
  local tmp; tmp="$(mktemp)"
  local status; status="$(curl -sS -o /dev/null -D "$tmp" -w "%{http_code}" --max-time 15 "$url" || echo "000")"
  local served_by; served_by="$(awk 'tolower($1)=="x-served-by:"{print tolower($2)}' "$tmp" | tr -d '\r')"
  local kob_env;   kob_env="$(awk 'tolower($1)=="x-kob-environment:"{print tolower($2)}' "$tmp" | tr -d '\r')"
  local proj_ref;  proj_ref="$(awk 'tolower($1)=="sb-project-ref:"{print tolower($2)}' "$tmp" | tr -d '\r')"
  rm -f "$tmp"

  if [ "$status" = "$want_status" ]; then pass "$label status $status"; else fail "$label expected $want_status, got $status"; fi
  if [ "$served_by" = "$EXPECTED_SERVED_BY" ]; then
    pass "$label x-served-by=$served_by"
  else
    fail "$label x-served-by expected '$EXPECTED_SERVED_BY', got '${served_by:-<missing>}' (Worker may not be deployed or hostname not bound)"
  fi
  if [ -n "$want_env" ]; then
    if [ "$kob_env" = "$want_env" ]; then pass "$label x-kob-environment=$kob_env"; else fail "$label x-kob-environment expected '$want_env', got '${kob_env:-<missing>}'"; fi
  fi
  if [ -n "$proj_ref" ] && [ "$proj_ref" != "$EXPECTED_PROJECT_REF" ]; then
    fail "$label sb-project-ref mismatch: '$proj_ref' (expected $EXPECTED_PROJECT_REF)"
  fi
}

hr; echo "Production gateway: $PROD"; hr
check_endpoint "PROD /health"          "$PROD/health"          200 "production"
check_endpoint "PROD /healthz"         "$PROD/healthz"         200 "production"
check_endpoint "PROD /v1/health"       "$PROD/v1/health"       200 ""
check_endpoint "PROD /openapi.json"    "$PROD/openapi.json"    200 ""
check_endpoint "PROD /v1/.well-known/openid-configuration" "$PROD/v1/.well-known/openid-configuration" 200 ""

hr; echo "Sandbox gateway: $SANDBOX"; hr
check_endpoint "SBX  /health"          "$SANDBOX/health"       200 "sandbox"
check_endpoint "SBX  /healthz"         "$SANDBOX/healthz"      200 "sandbox"
check_endpoint "SBX  /v1/health"       "$SANDBOX/v1/health"    200 ""
check_endpoint "SBX  /openapi.json"    "$SANDBOX/openapi.json" 200 ""

hr; echo "Auth gate (must REJECT unauthenticated /v1/* writes)"; hr
NOAUTH="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "$PROD/v1/accounts" || echo "000")"
[ "$NOAUTH" = "401" ] && pass "PROD /v1/accounts → 401 (auth gate active)" \
                      || fail "PROD /v1/accounts → $NOAUTH (expected 401 — auth gate may be misconfigured)"

hr
if [ "$FAILED" -eq 0 ]; then
  echo "All gateway health checks passed."
  exit 0
else
  echo "One or more checks FAILED. Common causes:"
  echo "  • Worker not deployed     → cd worker && npx wrangler deploy"
  echo "  • Stale Worker version    → redeploy to sync source ↔ live"
  echo "  • Hostname not bound      → Cloudflare → Workers → kob-gateway → Domains"
  echo "  • PUBLIC_PREFIXES missing → see worker/src/index.ts (PUBLIC_PREFIXES block)"
  exit 1
fi
