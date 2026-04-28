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
scan_host() {
  local label="$1"; local base="$2"
  echo "Scanning $label ($base) for internal origin leaks..."
  for path in "${ENDPOINTS[@]}"; do
    url="${base}${path}"
    body=$(curl -sS -L --max-time 15 "$url" || echo "")
    if [ -z "$body" ]; then
      echo "WARN  [$label] $path  (empty response — skipped)"
      continue
    fi
    matches=$(printf '%s' "$body" | grep -oE "$FORBIDDEN_PATTERN" | sort -u || true)
    if [ -n "$matches" ]; then
      echo "FAIL  [$label] $path"
      echo "      leaked: $(echo "$matches" | tr '\n' ' ')"
      FAIL=1
    else
      echo "PASS  [$label] $path"
    fi
  done
}

echo "Forbidden pattern: $FORBIDDEN_PATTERN"
echo "---"
scan_host "production" "$BASE_URL"
echo "---"
scan_host "sandbox"    "$SANDBOX_URL"

echo "---"
if [ "$FAIL" -ne 0 ]; then
  echo "REGRESSION DETECTED: internal origin URLs are leaking in public responses."
  exit 1
fi
echo "OK: no internal origin URLs found in public responses."
