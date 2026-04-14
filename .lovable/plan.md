

## Mega Super Master Prompt for Direct Backend E2E Audit

This is not a code change -- it is a reusable prompt document. Below is the complete prompt you can paste into any Lovable session to trigger a full E2E audit with permanent enforcement.

---

### THE PROMPT

```text
## KANG OPEN BANKING — DIRECT BACKEND E2E AUDIT (PERMANENT STANDING ORDER)

### OBJECTIVE
Run a complete end-to-end audit of ALL API endpoints verifying:
1. Every API call uses the DIRECT backend URL (VITE_SUPABASE_URL/functions/v1) — NO middle layer, NO Lovable frontend edge proxy, NO custom domain redirect that serves HTML.
2. Every endpoint returns application/json — NEVER text/html.
3. All 8 payment channels are tested and return valid JSON fee estimates.
4. Both live and sandbox domains resolve with valid SSL.
5. API key generation endpoints enforce auth guards correctly.
6. The api-contract-test edge function passes all 29+ checks.

### NON-NEGOTIABLE RULES (PERMANENT — DO NOT CHANGE)

RULE 1 — DIRECT BACKEND ONLY
All runtime API calls in the codebase MUST use:
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/<function-name>`
They must NEVER route through:
- api.kangopenbanking.com (serves SPA HTML, not edge functions)
- sandbox.kangopenbanking.com (serves SPA HTML, not edge functions)  
- Any Lovable preview URL
- Any proxy, gateway, or middleware layer
The ONLY acceptable runtime base URL pattern is: VITE_SUPABASE_URL + /functions/v1/

RULE 2 — JSON CONTRACT ENFORCEMENT
Every edge function response MUST set Content-Type: application/json.
If ANY endpoint returns text/html, it is a CRITICAL failure that must be fixed immediately.
Test by checking: response.headers.get('content-type').includes('application/json')

RULE 3 — THE 8-CHANNEL MANDATE
These 8 payment channels MUST be tested on every audit:
  mobile_money (XAF), card (XAF), bank_transfer (XAF), paypal (USD),
  apple_pay (USD), google_pay (USD), ussd (NGN), wallet (XAF)
Each must return a valid JSON fee estimate via gateway-charges-router?action=fee_estimate

RULE 4 — IMMUTABILITY (Standing Order 2 — The Ratchet)
- The api-contract-test edge function can only have tests ADDED, never removed.
- The liveEndpoints array in TestReport.tsx can only have entries ADDED, never removed.
- The functionBaseUrl in TestReport.tsx MUST always be: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
- These files are FROZEN against reduction: api-contract-test/index.ts, TestReport.tsx (endpoint registry)

RULE 5 — BIDIRECTIONAL VERIFICATION
- Frontend-to-Backend: Every fetch() call in /src must target VITE_SUPABASE_URL/functions/v1 directly.
- Backend-to-Frontend: Every edge function must return { Content-Type: application/json } headers.
- Search the entire src/ directory for any fetch() or supabase.functions.invoke() that does NOT use the direct backend URL pattern. Flag and fix any violations.

### AUDIT PROCEDURE (EXECUTE IN ORDER)

STEP 1 — URL PATTERN SCAN
Search all .ts and .tsx files in src/ for:
- Any hardcoded URL containing "supabase.co/functions" (should use env var instead)
- Any fetch() call to api.kangopenbanking.com or sandbox.kangopenbanking.com for API data (these serve HTML)
- Any supabase.functions.invoke() call (acceptable, but verify it does not route through frontend)
Report: List every file and line number where API calls are made. Confirm each uses the direct pattern.

STEP 2 — LIVE ENDPOINT TESTS (curl each one)
Use curl_edge_functions or direct fetch to test these endpoints and confirm JSON response:

Public endpoints (expect 200 + JSON):
  GET /api-health
  GET /public-api-spec  
  GET /oidc-config
  GET /postman-collection
  GET /gateway-fee-estimate?amount=5000&channel=mobile_money&currency=XAF
  GET /gateway-charges-router?action=fee_estimate&amount=5000&channel=mobile_money&currency=XAF
  GET /gateway-charges-router?action=fee_estimate&amount=10000&channel=card&currency=XAF
  GET /gateway-charges-router?action=fee_estimate&amount=100000&channel=bank_transfer&currency=XAF
  GET /gateway-charges-router?action=fee_estimate&amount=50&channel=paypal&currency=USD
  GET /gateway-charges-router?action=fee_estimate&amount=2500&channel=apple_pay&currency=USD
  GET /gateway-charges-router?action=fee_estimate&amount=2500&channel=google_pay&currency=USD
  GET /gateway-charges-router?action=fee_estimate&amount=5000&channel=ussd&currency=NGN
  GET /gateway-charges-router?action=fee_estimate&amount=10000&channel=wallet&currency=XAF

Protected endpoints (expect 401 + JSON, NOT HTML):
  POST /gateway-payouts-router {action: "list"}
  POST /gateway-disputes-router {action: "list"}
  POST /gateway-merchant-router {action: "list"}
  POST /gateway-webhooks-router {action: "endpoints"}
  POST /gateway-settlement-router {action: "list"}
  POST /banking-api-router {action: "list_banks"}
  POST /sandbox-create-api-key {key_name: "audit-test"}

STEP 3 — RUN CONTRACT TEST FUNCTION
  GET /api-contract-test
Verify: summary.all_passing === true, summary.total >= 29

STEP 4 — DOMAIN SSL CHECK
Verify these domains resolve and have valid SSL (HEAD request, expect 2xx or 3xx):
  https://kangopenbanking.com
  https://api.kangopenbanking.com
  https://sandbox.kangopenbanking.com

STEP 5 — STATIC SPEC FILES
Verify these return correct content (not HTML):
  https://kangopenbanking.com/openapi.json (expect application/json)
  https://kangopenbanking.com/openapi.yaml (expect yaml)
  https://kangopenbanking.com/openapi-sandbox.json (expect application/json)
  https://kangopenbanking.com/openapi-sandbox.yaml (expect yaml)

STEP 6 — REPORT
Produce a summary table:
  | Endpoint | Method | Status | Content-Type | Direct Backend? | Result |
For each of the ~25 endpoints above. Flag ANY that:
- Return text/html
- Route through a non-backend URL
- Return non-JSON body
- Have been removed from the test registry

### IF ANY FAILURE IS FOUND
1. Fix the endpoint or the calling code immediately.
2. Do NOT remove the test — add a fix.
3. Update the changelog with the fix.
4. Re-run the full audit to confirm 100% pass.

### WHAT MUST NEVER CHANGE
- src/pages/developer/TestReport.tsx: functionBaseUrl must stay as VITE_SUPABASE_URL/functions/v1
- supabase/functions/api-contract-test/index.ts: BASE must stay as SUPABASE_URL/functions/v1
- No endpoint may be removed from liveEndpoints array or contract test suites
- No payment channel may be removed from the 8-channel test matrix
```

---

### How to use this prompt

Copy the entire text block above and paste it as a message in any Lovable session for this project. It will trigger a full audit with fixes. You can run it after any deployment to verify nothing has regressed.

### What it enforces permanently

1. **Direct backend URLs only** -- no routing through custom domains that serve SPA HTML
2. **JSON-only responses** -- every endpoint validated against text/html contamination
3. **All 8 payment channels** tested every time
4. **Immutable test registry** -- tests can grow but never shrink
5. **Bidirectional verification** -- frontend calls checked AND backend responses checked

