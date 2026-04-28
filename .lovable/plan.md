# KOB API v1 — Developer Platform Hardening & Final Audit

## Discovery summary (already in place)

A discovery scan of the repo shows the project is far closer to "Stripe-grade" than the prompt assumes. The plan below only fills the **real remaining gaps**, without re-doing work.

| Area | Current state | Action needed |
|---|---|---|
| Forbidden URL leaks (`supabase.co/functions`, `gateway-charges-router`, `/functions/v1`) in public docs/SDKs/specs | **0 hits** across `.ts/.tsx/.json/.yaml/.md` | Verify only |
| OpenAPI spec | v4.17.2, 287 paths, canonical servers, x-pagination/x-error-catalog/x-rate-limits/x-webhook-policy/x-sandbox/x-sla/x-sdks all present | Add sandbox server entry + missing sandbox simulation paths |
| Canonical gateway routes | `/v1/gateway/charges` (+ `{id}`, cancel, capture, void, verify, preauth, events) all present | Add `/refund` sub-route alias to existing `/v1/gateway/refunds` |
| Sandbox functions | `sandbox`, `sandbox-create-account`, `sandbox-create-api-key`, `sandbox-test-webhook`, `sandbox-trigger-webhook`, `sandbox-generate-data` exist | Add thin router for `/v1/sandbox/{events,payments,webhooks,reset}` |
| SDKs | `@kangopenbanking/sdk-node` v1.2.0, `kangopenbanking` Python, `sdk-php` published with CI workflow | Verify only |
| Postman | `supabase/functions/postman-collection` generates live | Add static export under `/public/postman/` for download |
| Webhook headers | `X-Webhook-Signature`, `X-Webhook-ID`, replay protection (WH_004), stale ts (WH_005) | Add `Kang-Signature` / `Kang-Timestamp` / `Kang-Event-ID` aliases |
| Test suites | 20+ contract tests (gateway, rate-limit, security, idempotency, replay, pagination, status/version, openapi-fixtures, international-standards) | Add 1 final E2E "acceptance matrix" test that produces the audit report |

## What this plan will do

### Phase A — Canonical surface verification (no code changes)
1. Run the existing `worker/scripts/test-no-leak.sh` and the in-repo `docs-no-leak`, `direct-backend-guard`, `openapi-servers`, `international-standards-audit` test suites. Capture output as evidence.
2. Confirm OpenAPI servers list contains both `https://api.kangopenbanking.com/v1` (production) and a distinct **sandbox** entry — currently the second server is duplicated as production. **Fix:** change second entry to `https://sandbox-api.kangopenbanking.com/v1` in `public/openapi.json` + `.yaml`. Bump spec to **v4.17.3** (patch — additive per Standing Order 6).

### Phase B — Webhook header alias compatibility
The prompt requires `Kang-Signature`, `Kang-Timestamp`, `Kang-Event-ID`, `Kang-Webhook-ID`. Today we emit `X-Webhook-Signature`, `X-Webhook-ID`, `X-Webhook-Timestamp`. Per Standing Order 1 (THE LOCK) we cannot rename — so we **add** the `Kang-*` headers as aliases on outbound deliveries and accept either form on inbound verification.

Files:
- `supabase/functions/_shared/webhook-replay-protection.ts` — accept either header.
- `supabase/functions/gateway-deliver-webhook/index.ts` and `gateway-webhook-deliver-v2/index.ts` — emit both.
- `src/lib/webhook-event-schemas.ts` + verifier page — show both in examples.
- `public/openapi.json` `x-webhook-policy` — document both header families with the `X-*` set marked `legacy: true` and the `Kang-*` set marked `preferred: true`.

### Phase C — Sandbox simulation API surface
The prompt requires `POST /sandbox/events/simulate`, `/sandbox/payments/simulate`, `/sandbox/webhooks/send-test`, `/sandbox/reset`. Today we have implementation functions but the `/v1/sandbox/...` REST paths are not all in the spec.

1. Add a thin router `supabase/functions/sandbox-router/index.ts` that maps:
   - `POST /v1/sandbox/events/simulate` → existing `sandbox-trigger-webhook`
   - `POST /v1/sandbox/payments/simulate` → existing `sandbox` (payment simulation action)
   - `POST /v1/sandbox/webhooks/send-test` → existing `sandbox-test-webhook`
   - `POST /v1/sandbox/reset` → new action in `sandbox` function (truncates per-merchant sandbox tables)
2. Register routes in the Cloudflare worker (`worker/src/index.ts`) and in `public/openapi.json` (+ YAML + sandbox spec).
3. Document the canonical test-card / test-MoMo / test-bank tables (already in `x-sandbox`) on the existing `SandboxOverview` doc page — add the bank account test set since only cards + MoMo are present today.

### Phase D — Standard response envelope audit
Spot-check 5 representative endpoints (`/v1/gateway/charges`, `/v1/aisp/accounts`, `/v1/refunds`, `/v1/customers`, `/v1/webhooks/events`) to confirm they return `{ id, object, created, livemode, request_id, ... }` for resources and the documented list envelope for collections. Where `request_id` is missing from the response body, add it (it's already in the `X-Request-ID` header). Errors already use the `{error:{type,code,message,...}}` envelope per the error catalog — leave untouched.

### Phase E — Postman static export & docs
- Add `scripts/export-postman.mjs` that calls the live `postman-collection` edge function and writes:
  - `public/postman/Kang_Open_Banking_API_v1.postman_collection.json`
  - `public/postman/Kang_Open_Banking_Sandbox.postman_environment.json`
  - `public/postman/Kang_Open_Banking_Production.postman_environment.json`
- Add a "Run in Postman" button + direct download links on `src/pages/developer/PostmanCollection.tsx`.

### Phase F — Developer dashboard polish
Verify these dashboard pages render and link to live data: API Keys, Sandbox/Live toggle, Request Logs, Webhook Endpoints, Webhook Event Logs, Retry Webhook button, API Usage, Error Log Viewer, Copy Request ID, Go-Live Checklist. Most exist (`ApiKeys.tsx`, `ApiConsole.tsx`, `WebhookEventSimulator.tsx`, `IdempotencyPlayground.tsx`, `OnboardingWizard.tsx`). Add a single missing piece: **"Retry"** action button on the existing webhook event log list, calling `gateway-webhook-deliver-v2` with the original event id.

### Phase G — Changelog + acceptance test + audit report
1. Append changelog entry **v4.17.3 — Developer Platform Acceptance Pass (2026-04-28)** to `src/pages/developer/Changelog.tsx` covering: sandbox server URL fix, Kang-* header aliases, sandbox REST surface, webhook retry button, Postman static export.
2. Add `src/test/acceptance-matrix.test.ts` — a single test file that asserts every Phase 15 acceptance criterion (no Supabase URL in spec, gateway path present, sandbox path present, webhook policy lists both header families, Postman files exist, error catalog complete, x-pagination present, ≥3 SDKs declared). On run it writes a markdown report to `docs/audit/2026-04-28-developer-platform-acceptance.md`.
3. Final report sections: Executive summary, Files changed, Routes changed, Deprecated routes (none — additive only), Docs updated, OpenAPI validation result, Test report table, Remaining risks, Recommended next improvements, Score /10.

## What this plan will NOT do (and why)

- **No renames or removals** — Standing Order 1 (THE LOCK) and Order 4 (Surgeon Rule) forbid renaming `X-Webhook-*` headers, `chargeId` parameters, or operationIds without a major version bump. We add aliases instead.
- **No new SDK packages** — Node/Python/PHP already published with version pinning page and CI workflow.
- **No rewrite of 23 doc pages** — they exist and are covered by the `code-examples-smoke.test.ts` and `i18n-developer-pages-render.test.tsx` suites. We only add the missing bank-account sandbox table.
- **No /sandbox-api subdomain provisioning** — that's Cloudflare/DNS work outside the codebase. We document the URL and ensure the worker is ready to host it with the same routing it uses for `api.kangopenbanking.com`.

## Technical details

**Spec changes** (additive only; bump `info.version` 4.17.2 → 4.17.3):
```diff
 "servers": [
   { "url": "https://api.kangopenbanking.com/v1", "description": "Production" },
-  { "url": "https://api.kangopenbanking.com/v1", "description": "Sandbox" }
+  { "url": "https://sandbox-api.kangopenbanking.com/v1", "description": "Sandbox" }
 ],
 "x-webhook-policy": {
   "signature_header": "X-Webhook-Signature",
+  "signature_header_aliases": ["Kang-Signature"],
   "event_id_header": "X-Webhook-ID",
+  "event_id_header_aliases": ["Kang-Event-ID", "Kang-Webhook-ID"],
+  "timestamp_header": "X-Webhook-Timestamp",
+  "timestamp_header_aliases": ["Kang-Timestamp"],
 }
```

**New paths added to spec** (4 endpoints, all additive):
```text
POST /v1/sandbox/events/simulate
POST /v1/sandbox/payments/simulate
POST /v1/sandbox/webhooks/send-test
POST /v1/sandbox/reset
```

**Files to be created**:
- `supabase/functions/sandbox-router/index.ts`
- `scripts/export-postman.mjs`
- `public/postman/*.json` (3 files)
- `src/test/acceptance-matrix.test.ts`
- `docs/audit/2026-04-28-developer-platform-acceptance.md`

**Files to be edited**:
- `public/openapi.json` + `public/openapi.yaml` + `public/openapi-sandbox.json` + `public/openapi-sandbox.yaml`
- `supabase/functions/_shared/webhook-replay-protection.ts`
- `supabase/functions/gateway-deliver-webhook/index.ts`
- `supabase/functions/gateway-webhook-deliver-v2/index.ts`
- `supabase/functions/sandbox/index.ts` (add `reset` action)
- `src/lib/webhook-event-schemas.ts`
- `src/pages/developer/SandboxWebhookTester.tsx`
- `src/pages/developer/SandboxOverview.tsx` (add bank-account test table)
- `src/pages/developer/PostmanCollection.tsx`
- `src/pages/developer/Changelog.tsx`
- `worker/src/index.ts` (route `/v1/sandbox/*`)

**Estimated scope**: ~12 new/edited files, no breaking changes, all six Standing Orders honoured, single patch version bump.

After approval I'll execute Phases A through G in order and deliver the final audit report.