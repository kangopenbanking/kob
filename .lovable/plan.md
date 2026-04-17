<final-text>
Current findings

- The repo already contains `supabase/functions/gateway/index.ts`, `supabase/functions/oauth/index.ts`, and `supabase/functions/health/index.ts`, so the missing piece is not just “create the file”.
- The current `gateway` wrapper is too thin for the documented REST contract. It only proxies the first path segment, but the downstream gateway functions are action-based, not path-based.
- That means routes such as:
  - `GET /gateway/charges`
  - `GET /gateway/charges/:id`
  - `POST /gateway/charges/:id/verify`
  - `GET /gateway/refunds`
  cannot reliably work through the current wrapper, even if `/gateway/charges` itself exists.
- The codebase is still mixed:
  - many frontend docs pages now use flat function names like `gateway-charges-router`
  - several markdown docs still use nested public paths like `/functions/v1/gateway/charges`, `/functions/v1/oauth/token`, `/functions/v1/gateway/webhooks`
- OpenAPI still documents nested REST paths (`/v1/gateway/*`, `/v1/oauth/*`, `/v1/health`), so runtime compatibility must match that public contract.
- There is no dedicated route-existence CI guard yet. The existing guard only blocks deprecated domains, not missing public routes.

Implementation plan

1. Audit live deployment truth first
   - In writable mode, verify test (sandbox) and live (production) backend function reachability for `gateway`, `oauth`, `health`, and any other documented top-level families still exposed in public docs.
   - Produce a before-state matrix showing:
     - root function existence
     - representative nested route behavior
     - whether failures are top-level 404s or internal route mismatches

2. Replace the thin `gateway` proxy with a real REST-to-action translator
   - Keep the existing payment business logic functions unchanged.
   - Upgrade `supabase/functions/gateway/index.ts` so it maps method + path to existing downstream logic, for example:
     - `POST /charges` -> `gateway-charges-router`
     - `GET /charges` -> `gateway-query?action=list-charges`
     - `GET /charges/:id` -> `gateway-query?action=get-charge&id=:id`
     - `POST /charges/:id/verify` -> `gateway-charges-router?action=verify&id=:id`
     - `POST /charges/:id/validate` -> `gateway-charges-router?action=validate`
     - `POST /refunds` -> `gateway-create-refund`
     - `GET /refunds` -> `gateway-query?action=list-refunds`
     - `GET /refunds/:id` -> `gateway-query?action=get-refund&id=:id`
   - Apply the same pattern to payouts, disputes, settlements, merchants, webhooks, payment links, subscriptions, and other documented families where real downstream logic already exists.
   - Preserve auth, idempotency, query params, body forwarding, and CORS.
   - Remove the current automatic service-role header injection for protected routes so auth behavior remains correct.

3. Verify and tighten the other public compatibility entrypoints
   - Confirm `oauth/index.ts` correctly supports `/oauth/token`, `/oauth/authorize`, `/oauth/introspect`, and `/oauth/revoke`.
   - Confirm `health/index.ts` correctly supports `/health`.
   - Add or adjust any other top-level wrappers only where public docs/examples truly require nested routes.

4. Correct contract drift surgically
   - Audit each documented `/v1/gateway/*` path against real backend capability.
   - If a documented route already has real backend support, map it through the compatibility wrapper.
   - If a documented route has no real implementation today, correct the OpenAPI/docs/changelog instead of inventing new core behavior.

5. Align the public contract source of truth
   - Update the OpenAPI source of truth and re-sync:
     - `public/openapi.json`
     - `public/openapi.yaml`
     - `public/openapi-sandbox.json`
     - `public/openapi-sandbox.yaml`
   - Keep the public contract consistent with the direct backend base URL and nested documented paths.
   - Re-sync any generated Postman/spec assets from the same source.

6. Clean up the mixed documentation state
   - Standardize all public docs and quickstarts to one public contract: nested documented URLs that resolve on the direct backend base URL.
   - Fix the remaining stale markdown docs that still drift from runtime, especially:
     - developer quickstarts
     - unified payments
     - refunds
     - webhooks
     - marketplace checkout
     - bank data aggregator
     - versioning references
   - Update the changelog only after re-testing, so it reflects verified reality.

7. Audit internal consumers without rewriting the platform
   - Verify real executing callers across:
     - shared API wrappers
     - payment flows
     - test-report pages
     - backend function-to-function calls
   - Keep internal flat invocations where they are intentional and safe.
   - Only public-facing examples and external contract paths need nested compatibility guarantees.

8. Add regression guards
   - Extend `supabase/functions/api-contract-test/index.ts` to test the public nested contract, not just flat internal functions.
   - Update `/developer/test-report` to surface nested-route checks.
   - Add a route-existence CI workflow that fails if documented public routes return backend “Requested function was not found”.
   - Add a docs consistency scan so public docs cannot drift back to the wrong route style.

Validation plan

- Test sandbox first, then production after publish.
- For each route, acceptable outcomes are:
  - 200
  - 400
  - 401
  - 403
  - app-level 404 resource-not-found
- Unacceptable outcome:
  - backend “Requested function was not found”
- Minimum live matrix:
  - `/health`
  - `/oauth/token`
  - `/oauth/authorize`
  - `/gateway/charges`
  - `/gateway/charges/:id`
  - `/gateway/charges/:id/verify`
  - `/gateway/refunds`
  - `/gateway/refunds/:id`
  - `/gateway/payouts`
  - `/gateway/webhooks`
  - any other still-documented nested gateway families

Deliverables after implementation

- before/after deployment inventory
- sandbox vs production route matrix
- wrapper/router mapping summary
- OpenAPI correction summary
- docs/examples correction summary
- frontend/backend impact summary
- regression guard summary
- final readiness statement with live proof

Technical detail

- The key bug is not just missing deployment. The current `gateway` wrapper forwards path tails to downstream flat functions, but the downstream gateway functions expect `action`-style requests.
- Example: `GET /gateway/charges` currently maps toward `gateway-charges-router`, but that function treats unactioned `GET` requests as `fee_estimate`, not “list charges”.
- So the permanent fix is: keep the existing business functions, but make the public compatibility layer translate REST paths into the correct downstream actions, then prove that in sandbox and production with live tests.
</final-text>