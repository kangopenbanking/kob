#!/usr/bin/env bash
# ============================================================
# Local scan for forbidden deprecated API domains
# Run: ./scripts/scan-forbidden-domains.sh
# Returns exit 1 if any active file contains legacy domains.
# ============================================================

set -euo pipefail

echo "Scanning for forbidden deprecated API domains..."
echo ""

DOMAINS=("api\.kangopenbanking\.com" "sandbox\.kangopenbanking\.com" "mtls\.api\.kangopenbanking\.com")
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FOUND=0

for D in "${DOMAINS[@]}"; do
  MATCHES=$(grep -rn "${D}" \
    --include="*.ts" --include="*.tsx" --include="*.json" \
    --include="*.yaml" --include="*.yml" --include="*.php" \
    --include="*.py" --include="*.md" \
    --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git --exclude-dir=.lovable \
    --exclude="*.test.ts" --exclude="*.test.tsx" --exclude="*.spec.ts" \
    --exclude="forbidden-domain-gate.yml" \
    "${ROOT}" 2>/dev/null || true)

  if [ -n "$MATCHES" ]; then
    ACTIVE=$(echo "$MATCHES" \
      | grep -v "/src/test/" \
      | grep -v "/Changelog" \
      | grep -v "/docs/audit/" \
      | grep -v "/api-contract-test/" \
      | grep -v "/\.github/" \
      | grep -v "// WARNING" \
      | grep -v "// DO NOT" \
      | grep -v "// DEPRECATED" \
      | grep -v "// These domains" \
      | grep -v "// Old domain" \
      | grep -v "// Custom domains" \
      | grep -v "Custom domains.*serve the SPA" \
      | grep -v "must never be used for API calls" \
      | grep -v "description.*infrastructure correction" \
      | grep -v "description.*Direct Backend" \
      | grep -v "description.*deprecated" \
      || true)

    if [ -n "$ACTIVE" ]; then
      echo "FORBIDDEN: ${D}"
      echo "$ACTIVE"
      FOUND=1
    fi
  fi
done

if [ "$FOUND" -eq 1 ]; then
  echo ""
  echo "FAIL: Forbidden domains found in active code."
  exit 1
fi

echo "PASS: No forbidden domains in active code."
