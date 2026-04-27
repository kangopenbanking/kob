#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Kang Open Banking — Local Gateway Smoke Test
# ----------------------------------------------------------------------------
# Boots `wrangler dev` (which forwards /v1/* to the real Supabase origin
# defined in wrangler.toml [vars] ORIGIN_BASE) and verifies the gateway
# is functioning correctly before deploying.
#
# Usage:
#   cd worker && ./scripts/test-local.sh                # uses port 8787
#   PORT=9000 ./scripts/test-local.sh                   # custom port
#   API_KEY=sk_test_xxx ./scripts/test-local.sh         # exercise auth
# ----------------------------------------------------------------------------
set -euo pipefail

PORT="${PORT:-8787}"
BASE="http://127.0.0.1:${PORT}"
API_KEY="${API_KEY:-}"

cd "$(dirname "$0")/.."

echo "▸ Starting wrangler dev on :${PORT} ..."
npx wrangler dev --port "${PORT}" --local=false >/tmp/wrangler-dev.log 2>&1 &
WRANGLER_PID=$!
trap 'kill "${WRANGLER_PID}" 2>/dev/null || true' EXIT

# Wait for readiness (max 30s).
for i in $(seq 1 30); do
  if curl -sf "${BASE}/health" >/dev/null 2>&1; then break; fi
  sleep 1
done

pass() { printf "  ✓ %s\n" "$1"; }
fail() { printf "  ✗ %s\n" "$1"; FAILED=1; }
FAILED=0

echo
echo "▸ Test 1 — /health returns version + upstream latency"
HEALTH="$(curl -s "${BASE}/health")"
echo "${HEALTH}" | grep -q '"service": "kob-edge-gateway"' && pass "service identifier" || fail "service identifier"
echo "${HEALTH}" | grep -q '"version"'                     && pass "version present"     || fail "version present"
echo "${HEALTH}" | grep -q '"latency_ms"'                  && pass "upstream latency"    || fail "upstream latency"

echo
echo "▸ Test 2 — /openapi.json proxies the public spec"
SPEC_STATUS="$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/openapi.json")"
[ "${SPEC_STATUS}" = "200" ] && pass "/openapi.json → 200" || fail "/openapi.json → ${SPEC_STATUS}"

echo
echo "▸ Test 3 — /v1/* requires an API key"
NOAUTH="$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/v1/accounts")"
[ "${NOAUTH}" = "401" ] && pass "unauthenticated → 401" || fail "unauthenticated → ${NOAUTH} (expected 401)"

echo
echo "▸ Test 4 — sandbox routes are public (P3 Free Sandbox)"
SANDBOX="$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/v1/sandbox/ping" || echo "000")"
[ "${SANDBOX}" != "401" ] && pass "/v1/sandbox/* not gated" || fail "/v1/sandbox/* should be public"

if [ -n "${API_KEY}" ]; then
  echo
  echo "▸ Test 5 — provided API key is accepted"
  AUTHED="$(curl -s -o /dev/null -w "%{http_code}" -H "x-api-key: ${API_KEY}" "${BASE}/v1/accounts")"
  [ "${AUTHED}" != "401" ] && [ "${AUTHED}" != "403" ] \
    && pass "x-api-key accepted (HTTP ${AUTHED})" \
    || fail "x-api-key rejected (HTTP ${AUTHED})"
fi

echo
if [ "${FAILED}" -eq 0 ]; then
  echo "✅ All gateway smoke tests passed."
  exit 0
else
  echo "❌ One or more tests failed. See /tmp/wrangler-dev.log for details."
  exit 1
fi
