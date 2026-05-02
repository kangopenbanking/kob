## Context

Claude's audit of v4.27.2 found three spec regressions, four coverage gaps on newly added operations, and six portal pages still rendering as stubs in the prerendered HTML. We will fix all of them, ratchet richness tests, and bump the spec to **v4.27.3** per Standing Order 6 (Version Gate). All spec edits are additive except the deletion of three duplicate legacy webhook paths, which is a bugfix removing accidental reintroduction.

---

## Track A — OpenAPI spec fixes (`public/openapi.json` + `public/openapi.yaml`)

1. **Remove legacy provider webhook paths** (regression fix)
   - Delete `/webhooks/stripe`, `/webhooks/flutterwave`, `/webhooks/paypal` (operationIds `inboundWebhookStripe/Flutterwave/PayPal`).
   - Keep canonical `/v1/webhooks/providers/{stripe|flutterwave|paypal}` (operationIds `receiveStripeWebhook/Flutterwave/Paypal`).
2. **Declare `BankConnectors` tag** in global `tags[]` with description and `externalDocs` link to `/developer/banks/connector-runbook`.
3. **Add `429 Too Many Requests`** (`$ref: '#/components/responses/TooManyRequests'`) to the 23 ops missing it (new connector, admin, gateway export, healthz, sandbox, auth ops).
4. **Add `401 Unauthorized`** to the 6 flagged ops: `getJwksWellKnown` (skip — public), `connectorImportGet`, `connectorBatchGet`, `connectorBatchDownload`, `merchantWebhookRotateSecret`, `gatewayStatementDownload`. (For `getJwksWellKnown`, document the public exemption with `x-public-endpoint: true` instead.)
5. **Add `400 Bad Request`** to the 6 POST/PUT/PATCH ops listed (`extendConsent`, `merchantApiKeyRotate`, `merchantWebhookRotateSecret`, plus the v1 receive* webhook ops that replace the deleted legacy ones).
6. **Add `x-fapi-interaction-id` header** to 200/201 responses on the 50 new ops missing it (use a shared `$ref: '#/components/headers/XFapiInteractionId'`, creating the header component if absent).
7. **Add `required[]` arrays** to schemas `WebhookReplayRequest`, `DcrRegistrationRequest`, `WebhookEventType`.
8. **Bump `info.version`** to `4.27.3` and add changelog `docs/governance/CHANGELOG-v4.27.3.md` citing standards (FAPI 1.0 §6.2.1.13 for x-fapi-interaction-id, RFC 6585 for 429, RFC 7235 for 401, RFC 7807 for problem responses, OpenAPI 3.0.3 §4.7.19 for tag declarations).
9. **Regenerate** `public/openapi.yaml` and `public/postman/Kang_Open_Banking_API_v4.27.3.postman_collection.json` (+ update `public/postman/manifest.json` and the `_latest` alias).

## Track B — Portal prerendered HTML fixes (`vite-plugin-prerender-docs.ts`)

1. **Getting Started** — strip every `"provider": "mtn_momo"` line from the embedded code blocks (canonical body uses `channel`+`customer_phone` only, matching the React component and the spec).
2. **Replace stub HTML** for the six pages flagged as generic stubs in the live crawl, mirroring the React content already shipped:
   - `/developer/authentication` → full OAuth 2.0 + API key guide (token exchange, scopes, mTLS pointer, key rotation).
   - `/developer/api-explorer` → server-rendered Redoc `<redoc spec-url="/openapi.json">` block + Swagger UI deep-link + Postman/SDK download list (already partially present — extend with H1, intro, and field tables so it satisfies CFT/UTT and Order P6).
   - `/developer/gateway/quickstart` → 5-step tutorial (auth → charge → poll → webhook handler → payout) using canonical fields.
   - `/developer/gateway/webhooks` → event catalogue table for the 8 documented `x-webhooks` plus HMAC verification example (Node + Python + PHP).
   - `/developer/guides/sdks` → install instructions for `@kangopenbanking/sdk` (npm), `kangopenbanking` (pip), `kangopenbanking/sdk-php` (composer), with quickstart per language.
   - `/developer/examples/real-world` → three end-to-end scenarios (e-commerce checkout, payroll bulk payout, AISP account aggregation) each with a code sample and a sequence diagram in ASCII.
3. Each rebuilt page must satisfy the existing Mega-v5 guards: unique `<title>`, unique `<h1>`, no legacy field names, no `*.supabase.co` host, ≥80-char description, multi-language code samples per Order P9.

## Track C — Tests (ratchet upward, never down)

Add/extend Vitest specs:

1. **`src/test/openapi-v4-27-3-regressions.test.ts`** (new):
   - Asserts `/webhooks/stripe|flutterwave|paypal` paths are absent.
   - Asserts every tag used by an operation appears in global `tags[]`.
   - Asserts each named op above carries 401 / 400 / 429 as required.
   - Asserts every 200/201 response on every operation declares the `x-fapi-interaction-id` header.
   - Asserts the three schemas declare `required[]`.
   - Asserts `info.version === '4.27.3'` and changelog file exists.
2. **Extend `src/test/openapi-richness.test.ts`** thresholds: response examples and code-samples coverage stays at 391/391; add new floor `xFapiCoverage = ops.length`.
3. **Extend `src/test/developer-portal-mega-v5-guards.test.ts`**: add CFT/UTT/CAT entries for the six rebuilt pages and a hard-fail check for the legacy `"provider":` substring across all prerendered HTML.
4. **Extend `src/test/postman-collection-publishing.test.ts`**: bump expected version to 4.27.3 and verify manifest sync.

Run all four suites + the existing portal/charge-fields/postman suites; do not ship until 100% green.

## Technical details

- Heavy spec edits are scripted: a one-shot Node script (`scripts/apply-v4.27.3-fixes.mjs`, run once and kept under `scripts/` for audit history) loads `openapi.json`, applies the seven changes deterministically, then writes JSON + emits YAML via `js-yaml`. This keeps Standing Order 4 (Surgeon Rule) clean — no hand-edits across 391 ops.
- The `XFapiInteractionId` header component will be defined once under `components.headers` with `schema: { type: string, format: uuid }` and `description` citing FAPI 1.0 §6.2.1.13.
- Postman regeneration reuses `scripts/regen-postman.mjs`; we only invoke it after the spec lands.
- No DB migrations, no edge functions, no new dependencies.

## Files touched

- `public/openapi.json`, `public/openapi.yaml` (regenerated)
- `public/postman/Kang_Open_Banking_API_v4.27.3.postman_collection.json` (new), `_latest` alias, `manifest.json`
- `vite-plugin-prerender-docs.ts` (six page HTML rewrites + Getting Started field cleanup)
- `docs/governance/CHANGELOG-v4.27.3.md` (new)
- `scripts/apply-v4.27.3-fixes.mjs` (new, idempotent)
- `src/test/openapi-v4-27-3-regressions.test.ts` (new)
- `src/test/openapi-richness.test.ts`, `src/test/developer-portal-mega-v5-guards.test.ts`, `src/test/postman-collection-publishing.test.ts` (extended)

## Done criteria

- All seven flagged spec issues resolved; `info.version = 4.27.3`.
- Six portal pages render full content in prerendered HTML (no stubs).
- Getting Started prerender contains zero `"provider":` lines.
- All Vitest suites listed above pass; existing 32 passing tests still pass.
- New CHANGELOG cites every standard per Standing Order 3.
