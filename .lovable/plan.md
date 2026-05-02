## What already exists (verified, do not rebuild)

| Requested feature | Existing implementation | Gap |
|---|---|---|
| Webhook event replay + admin UI | `supabase/functions/admin-webhook-replay`, `admin-webhook-dlq-replay`, `gateway-webhook-replay-delivery`; `src/pages/admin/AdminWebhookReplay.tsx` (254 lines, status badges, audit table) | **Mostly done** — only needs a "Replay history" tab and bulk replay |
| OAuth client credentials flow | `oauth-token` (`grant_type=client_credentials` since v3), `oauth-authorize`, `oauth-introspect`, `oauth-revoke`, `dcr-register` (RFC 7591), `api_clients` table, `InstitutionApiClients.tsx`, admin `ApiClientManagement.tsx` | **Done at the API layer**. Needs a polished, branded *application registration* page for non-technical institution users that doesn't require crafting a signed SSA |
| Bank connector runbook | `src/pages/developer/BankConnectorRunbook.tsx` (227 lines, 4 phases, 9 statuses) | Needs an interactive **sandbox simulator** widget |
| Sandbox payment flows | `sandbox`, `sandbox-router`, `sandbox-trigger-webhook`, `POST /v1/sandbox/payments/simulate` | Existing simulator is generic. Needs **per-provider (Stripe/Flutterwave/PayPal) end-to-end** simulators that fan signed webhooks back into the canonical receivers |
| OpenAPI version diff | None | **Net new** |

The plan below builds only the missing parts and leaves all existing behaviour intact (Standing Order 4 — Surgeon Rule).

---

## Track 1 — OpenAPI version diff (net new)

### Backend
- New edge function `openapi-spec-diff` (`supabase/functions/openapi-spec-diff/index.ts`).
  - `GET /v1/spec/diff?from=4.27.2&to=4.27.3`
  - Loads two specs from a new public folder `public/openapi-history/` (snapshots committed when version bumps); falls back to the live `public/openapi.json` for `to=current`.
  - Returns RFC 6902-style structured diff: `{ added_paths[], removed_paths[], changed_paths[], added_schemas[], removed_schemas[], required_field_changes[], breaking, summary }`.
  - Uses a small in-house comparator (no new deps) — three passes over `paths`, `components.schemas`, and `info.version`.
  - Public, unauthenticated, cached `Cache-Control: public, max-age=300`.
- Snapshot `public/openapi.json` → `public/openapi-history/openapi-4.27.3.json` and seed prior versions present in changelog (`4.27.2`, `4.27.1`, `4.27.0`, `4.6.0`, `4.5.0`, `4.4.0`, `4.3.0`, `4.2.0`) by hand-curated synthetic prior snapshots only where the live JSON differs — for older versions we ship a **manifest entry** marking them as "manifest-only" so the diff tool surfaces changelog text rather than full JSON. This avoids fabricating spec history.
- Register the route in `sandbox-router` AND in the public router so the production gateway exposes `/v1/spec/diff`.

### Frontend
- New developer page `src/pages/developer/SpecDiff.tsx` at `/developer/spec-diff` (PERMANENT PUBLIC ROUTE).
  - Two `<Select>` controls (from / to) populated from a new `/spec/versions` listing endpoint.
  - Shows three sections: **Added**, **Removed**, **Changed** (with a "Breaking change" red badge for any required-field removal, status-code removal, or path/operationId removal).
  - Uses `react-diff-viewer-continued` if already present; otherwise plain side-by-side `<pre>` blocks (no new dep).
  - Prerendered HTML snippet so the page is crawlable per Order P6.
- Link added to `/developer/changelog` ("Compare versions side-by-side →") and to `/developer` Quick Links.

## Track 2 — Provider-payment sandbox simulators (extends existing sandbox)

Net intent: hitting one endpoint should mint a fake provider charge, store it via the canonical receiver, persist a `webhook_inbox` row with a valid HMAC signature, and update the gateway charge — exactly as a real provider would.

### Backend
- New edge function `sandbox-provider-simulator` (`supabase/functions/sandbox-provider-simulator/index.ts`):
  - `POST /v1/sandbox/providers/{stripe|flutterwave|paypal}/simulate`
  - Body: `{ scenario: "success" | "declined" | "timeout" | "dispute_opened" | "refund", amount, currency, customer? }`
  - Builds a realistic provider payload, signs it with the matching secret (`STRIPE_WEBSECRET_KEY`, `FLUTTERWAVE_ENCRYPTION_KEY`, `PAYPAL_WEBHOOK_ID`), and `fetch`-POSTs it to the in-process receiver function URL (`gateway-webhook-stripe` / `flutterwave` / `paypal`).
  - Returns the receiver's response, the synthetic `event_id`, and a links object so the developer can poll `/v1/gateway/charges/{id}` and `/v1/webhooks/{id}/deliveries`.
- Wire the new route into `sandbox-router` so it's reachable behind the public `/v1/sandbox/...` namespace.

### Frontend (developer-facing)
- Extend `src/pages/developer/SandboxSimulateWebhooks.tsx` (existing) with a **per-provider tab** (Stripe / Flutterwave / PayPal) and a 5-step progress strip showing: simulate → receiver verifies → inbox row → charge updated → outbound webhook delivered.
- No new admin page needed — the receiver feeds the existing AdminWebhookReplay table automatically.

## Track 3 — Application registration UX (institution-facing wrapper for existing client_credentials flow)

The API already issues client_credentials tokens via `oauth-token` and `dcr-register`. The gap is that institutions currently need to craft a signed Software Statement Assertion. We add a guided UI that does it for them.

### Frontend
- Extend `src/pages/institution/InstitutionApiClients.tsx`:
  - "Register new application" wizard (3 steps: app metadata → grant types & scopes → confirmation with downloadable `client_id` + `client_secret`, one-time view per existing API Key Governance memory).
  - Shows the test cURL/Node/Python snippets for `client_credentials` token exchange, with the institution's actual `client_id` filled in.
  - Lists active applications with rotate-secret and revoke actions (already supported by `oauth-revoke`).

### Backend
- Add a thin edge function `institution-register-app` that wraps `dcr-register`: accepts plain-form metadata, generates the SSA server-side using the institution's already-trusted JWKS, then calls `dcr-register`. Returns the registration result.
- No schema changes required — `api_clients` table already supports the flow.

## Track 4 — Connector runbook sandbox simulator widget (extends existing runbook)

### Frontend
- New component `src/components/developer/ConnectorSandboxSimulator.tsx` embedded into `BankConnectorRunbook.tsx`:
  - "Try it" panel where developers pick a phase (Ingest / Validate / Reconcile) and a fixture (`good.csv`, `partial.csv`, `bad-headers.csv`, `pain-001-sample.xml`).
  - Calls existing `bank-file-connector` in sandbox mode (`x-sandbox: true` header) and renders the resulting status timeline using the same status badges shown elsewhere on the page.
  - No backend changes — `bank-file-connector` already accepts the sandbox header.

## Track 5 — Webhook replay polish (existing UI tightening)

- Add a **"Replay history"** subtab to `AdminWebhookReplay.tsx` that reads from `webhook_replay_audit` and shows actor / timestamp / outcome.
- Add bulk replay: checkbox selection + "Replay selected" with a confirmation dialog, dispatched serially to keep idempotency clean.
- No new endpoint — existing `admin-webhook-replay` is invoked once per row.

---

## Spec & docs governance (Standing Orders)

- New spec ops added (do not affect counts): `GET /v1/spec/versions`, `GET /v1/spec/diff`, `POST /v1/sandbox/providers/{provider}/simulate`. All include `429`, `401` (only `spec/*` are `x-public-endpoint: true`), `400` on POST, `x-fapi-interaction-id` on 200.
- Bump `info.version` → **4.28.0** (minor — net-new endpoints, additive only).
- New changelog `docs/governance/CHANGELOG-v4.28.0.md` citing OAuth 2.0 RFC 6749 §4.4 (client credentials), RFC 7592 (DCR management), RFC 6902 (JSON patch — diff format), FAPI 1.0 §6.2.1.13.
- Regenerate `public/openapi.yaml` and Postman collection `Kang_Open_Banking_API_v4.28.0.postman_collection.json` via the existing `apply-…` + `regen-postman.mjs` scripts.

## Tests

1. `src/test/openapi-v4-28-0-additions.test.ts` — asserts the three new ops exist with full coverage envelope (and that v4.27.3 floors still hold).
2. `src/test/spec-diff.test.ts` — calls the diff edge function locally with two fixture specs and asserts breaking-change detection logic (path removal, required-field removal, status-code removal).
3. Vitest for `SpecDiff.tsx` — happy path with mocked fetch.
4. Extend `developer-portal-mega-v5-guards.test.ts` with `/developer/spec-diff` UTT/CFT/CAT entries.
5. Extend `postman-collection-publishing.test.ts` to expect v4.28.0.
6. Extend `openapi-richness.test.ts` floor to 391 ops (388 + 3 new).

## Files touched (high level)

- New edge functions: `openapi-spec-diff`, `sandbox-provider-simulator`, `institution-register-app`
- New folder: `public/openapi-history/` with `manifest.json` + `openapi-4.27.3.json`
- New pages/components: `src/pages/developer/SpecDiff.tsx`, `src/components/developer/ConnectorSandboxSimulator.tsx`
- Extended: `InstitutionApiClients.tsx`, `BankConnectorRunbook.tsx`, `SandboxSimulateWebhooks.tsx`, `AdminWebhookReplay.tsx`, `App.tsx` (new route), `sandbox-router`, prerender plugin (new page entry + spec-diff link), changelog
- Spec: `public/openapi.json`, `public/openapi.yaml`, sandbox variants, Postman collection (regenerated)
- Tests: 5 new/extended Vitest files

## Done criteria

- `/developer/spec-diff` renders and successfully diffs `4.27.2` ↔ `4.27.3`, flagging zero breaking changes.
- `POST /v1/sandbox/providers/stripe/simulate` with `scenario:"success"` produces a verified `webhook_inbox` row, updates the charge, and triggers the outbound merchant webhook in <2s.
- An institution user can complete application registration in under 60 seconds and immediately mint a token via `client_credentials`.
- The runbook page's "Try it" panel completes a sandbox CSV ingest cycle without leaving the page.
- All Vitest suites green; spec at v4.28.0 with new changelog and Postman files.
