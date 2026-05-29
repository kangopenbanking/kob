# Phase 11 — Integrator Experience & Governance

System version bump: **4.48.0 → 4.49.0** (minor; pure additions, Standing Orders #1–#6 honoured).

## 1. Enriched Postman environments (Sandbox + Production)

Update both files in `public/postman/`:

- `Kang_Open_Banking_Sandbox.postman_environment.json`
- `Kang_Open_Banking_Production.postman_environment.json`

Add variables (preserve `base_url` + `api_key`):

| Key | Sandbox default | Production default | Type |
|---|---|---|---|
| `base_url` | `https://sandbox-api.kangopenbanking.com/v1` | `https://api.kangopenbanking.com/v1` | default |
| `api_key` | `sk_test_REPLACE_ME` | `sk_live_REPLACE_ME` | secret |
| `key_issuer_url` | `…/developer/keys` | `…/admin/api-keys` | default |
| `webhook_secret` | `whsec_test_REPLACE_ME` | `whsec_live_REPLACE_ME` | secret |
| `idempotency_key` | `{{$guid}}` | `{{$guid}}` | default |
| `accept_language` | `en` | `en` | default |
| `spec_url` | `https://kangopenbanking.com/openapi-sandbox.json` | `https://kangopenbanking.com/openapi.json` | default |
| `spec_version` | current `KOB_API_VERSION` | current `KOB_API_VERSION` | default |
| `merchant_id` | `mer_sandbox_demo` | `` | default |

Add a small `README_postman.md` under `public/postman/` showing the import flow + how to retrieve the API key from `/developer/keys`.

## 2. "Send test webhook" admin button

- Add a `TestWebhookDialog` triggered from `AdminWebhookDeliveries.tsx` (Deliveries tab header).
- Inputs: endpoint dropdown (loaded from `gateway_webhook_endpoints`), event type dropdown (curated CEMAC + gateway events: `payment.succeeded`, `qr.paid`, `remittance.cemac.paid`, `agent.cashin.completed`, `ussd.session.ended`, plus the existing set), optional custom JSON payload.
- New edge function `admin-send-test-webhook` (admin-gated): generates a synthetic `event_id`, signs with the endpoint secret, writes a row to `gateway_webhook_deliveries` with `is_test=true` (add column), invokes the existing dispatcher, returns the delivery id + status + response code + latency.
- After success, dialog shows confirmation card with delivery id, click-through to the Deliveries row.

## 3. Institution API key admin console

New route `/admin/institution-api-keys` (page `AdminInstitutionApiKeys.tsx`):

- Tabs: **Keys**, **Usage & rate limits**.
- Keys tab: table of all institution-scoped keys with create / rotate / suspend / revoke actions. Reuses existing `api-keys-rotate` and `api-keys-revoke` functions. Adds `api-keys-create` and `api-keys-suspend` (new edge functions). One-time plaintext shown on create/rotate (already memory rule).
- Usage tab: per-key counters (calls last 24h / 7d), success/error rate, last rate-limit hit, current bucket remaining. Reads from `gateway_request_logs` (existing) aggregated by `api_key_id`.

New table column on `gateway_merchant_api_keys`: `status` enum (`active|suspended|revoked`) if not already present; `suspended_at`.

## 4. Ratchet tests for phase 10 modules

New Vitest file `src/test/openapi-phase10-modules-ratchet.test.ts` asserting (against `public/openapi.json`):

- USSD paths + schemas present (`/v1/ussd/sessions`, `UssdSession`, etc.)
- Agents paths + schemas (`/v1/agents`, `Agent`, `AgentCashRequest`, …)
- QR + offline (`/v1/gateway/qr`, `QrCode`, `OfflineToken`, …)
- CEMAC remittance (`/v1/remittance/cemac/corridors`, `CemacRemittance`, …)
- For each path: required `Idempotency-Key` where applicable, `Accept-Language` parameter, `200/201/4xx` responses present.
- Standing Order #2 ratchet: required[] arrays never shrink vs the latest history snapshot.

Plus a Deno test under `supabase/functions/cemac-remittance/quote_test.ts` exercising the quote math.

## 5. Per-version OpenAPI export + Postman "Import Spec" flow

Already have `public/openapi-history/openapi-{version}.json`. Add:

- New page `/developer/spec-versions` (`DeveloperSpecVersions.tsx`) listing every snapshot from `openapi-history/manifest.json`, with copy-URL + download-JSON + download-YAML buttons (YAML generated client-side via existing `js-yaml`).
- A new server-side YAML mirror script `scripts/snapshot-openapi-yaml-history.mjs` writing `openapi-history/openapi-{version}.yaml` for each JSON snapshot that does not yet have a sibling YAML. Wire into `sync-version-artifacts.mjs`.
- Add a Postman section on the new page: a copy-able "Import → Link" URL pointing to the per-version JSON, plus instructions screenshot. Add a `postman_import_url` variable to both environments.
- Bump `KOB_API_VERSION` + Postman + changelog as usual.

## Files

**New**
- `src/pages/admin/AdminInstitutionApiKeys.tsx`
- `src/components/admin/TestWebhookDialog.tsx`
- `src/pages/developer/DeveloperSpecVersions.tsx`
- `supabase/functions/admin-send-test-webhook/index.ts`
- `supabase/functions/api-keys-create/index.ts`
- `supabase/functions/api-keys-suspend/index.ts`
- `supabase/functions/cemac-remittance/quote_test.ts`
- `scripts/snapshot-openapi-yaml-history.mjs`
- `scripts/phase11-spec-additions.mjs` (adds `/v1/admin/webhooks/test`, `/v1/admin/api-keys/*` operations + schemas to spec, additive only)
- `public/postman/README_postman.md`
- `src/test/openapi-phase10-modules-ratchet.test.ts`

**Edited**
- `public/postman/Kang_Open_Banking_Sandbox.postman_environment.json`
- `public/postman/Kang_Open_Banking_Production.postman_environment.json`
- `src/pages/admin/AdminWebhookDeliveries.tsx` (mount TestWebhookDialog)
- `src/App.tsx` (2 new routes)
- `src/config/version.ts` → `4.49.0`
- `public/changelog.json` (Phase 11 entry, cites RFC 6920 / OAS 3.1 / OWASP API Top 10 2023)
- `scripts/sync-version-artifacts.mjs` (call YAML history mirror)

**Migration**
- Add `is_test BOOLEAN DEFAULT false` to `gateway_webhook_deliveries` (if absent).
- Add `status` + `suspended_at` to `gateway_merchant_api_keys` (if absent) with the enum check.

## Verification

- `node scripts/phase11-spec-additions.mjs && node scripts/sync-version-artifacts.mjs` — should pass.
- `bunx vitest run src/test/openapi-phase10-modules-ratchet.test.ts` — green.
- Live smoke: deploy `admin-send-test-webhook`, fire from the dialog against a sandbox endpoint, confirm row appears in Deliveries with `is_test=true`.
- Spec snapshots verified: each entry in `openapi-history/manifest.json` has both `.json` and `.yaml` after sync.

Approve to proceed?
