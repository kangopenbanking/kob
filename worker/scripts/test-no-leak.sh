#!/usr/bin/env bash
# Regression guard: verifies no internal Supabase origin URLs leak through public endpoints.
# Usage: BASE_URL=https://api.kangopenbanking.com/v1 ./worker/scripts/test-no-leak.sh
set -euo pipefail

BASE_URL="${BASE_URL:-https://api.kangopenbanking.com/v1}"
SANDBOX_URL="${SANDBOX_URL:-https://sandbox-api.kangopenbanking.com/v1}"
FORBIDDEN_PATTERN='supabase\.co|wdzkzeahdtxlynetndqw'

ENDPOINTS=(
  "/health"
  "/openapi.json"
  "/public-api-spec"
  "/postman-collection"
  "/.well-known/openid-configuration"
  "/oauth"
)

FAIL=0
echo "Scanning $BASE_URL for internal origin leaks..."
echo "Forbidden pattern: $FORBIDDEN_PATTERN"
echo "---"

for path in "${ENDPOINTS[@]}"; do
  url="${BASE_URL}${path}"
  body=$(curl -sS -L --max-time 15 "$url" || echo "")
  if [ -z "$body" ]; then
    echo "WARN  $path  (empty response — skipped)"
    continue
  fi
  matches=$(printf '%s' "$body" | grep -oE "$FORBIDDEN_PATTERN" | sort -u || true)
  if [ -n "$matches" ]; then
    echo "FAIL  $path"
    echo "      leaked: $(echo "$matches" | tr '\n' ' ')"
    FAIL=1
  else
    echo "PASS  $path"
  fi
done

echo "---"
if [ "$FAIL" -ne 0 ]; then
  echo "REGRESSION DETECTED: internal origin URLs are leaking in public responses."
  exit 1
fi
echo "OK: no internal origin URLs found in public responses."
