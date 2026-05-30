#!/usr/bin/env bash
# Verify ownership of both Kang properties in Google Search Console
# and submit the sitemap.xml. Re-run this AFTER republishing the site
# so the google-site-verification meta tags are live.
#
# Requires env: LOVABLE_API_KEY, GOOGLE_SEARCH_CONSOLE_API_KEY
set -euo pipefail

GW="https://connector-gateway.lovable.dev/google_search_console"
H_AUTH="Authorization: Bearer ${LOVABLE_API_KEY}"
H_KEY="X-Connection-Api-Key: ${GOOGLE_SEARCH_CONSOLE_API_KEY}"

verify_and_register() {
  local origin="$1"
  echo "=== ${origin} ==="

  echo "-> verify META ownership"
  curl -s -X POST "${GW}/siteVerification/v1/webResource?verificationMethod=META" \
    -H "${H_AUTH}" -H "${H_KEY}" -H "Content-Type: application/json" \
    -d "{\"site\":{\"identifier\":\"${origin}\",\"type\":\"SITE\"}}"
  echo

  local enc; enc=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1], safe=''))" "${origin}")

  echo "-> add site to Search Console"
  curl -s -X PUT "${GW}/webmasters/v3/sites/${enc}" -H "${H_AUTH}" -H "${H_KEY}"
  echo

  echo "-> submit sitemap.xml"
  local sm; sm=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1], safe=''))" "${origin}sitemap.xml")
  curl -s -X PUT "${GW}/webmasters/v3/sites/${enc}/sitemaps/${sm}" -H "${H_AUTH}" -H "${H_KEY}"
  echo

  echo "-> list submitted sitemaps"
  curl -s "${GW}/webmasters/v3/sites/${enc}/sitemaps" -H "${H_AUTH}" -H "${H_KEY}"
  echo
}

verify_and_register "https://kangopenbanking.com/"
verify_and_register "https://kob.lovable.app/"
