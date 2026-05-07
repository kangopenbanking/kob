## Goal

The uploaded "Mega Implementation Prompt" lists 18 enhancements. Most are documentation / DX additions. Many are already implemented in this codebase. The plan adds only what's missing, strictly additively (Standing Orders 1, 4 — no rename, no removal, no API surface changes).

## What already exists (no work needed)

- `/developer` pages: `QuickStart`, `AuthOAuth2`, `AuthMtls`, `ErrorCodesReference`, `RateLimits` + `RateLimitsGuide`, `IdempotencyGuide` + `IdempotencyPlayground`, `SDKsPage`, `SdkInstallPage`, `SdkVersionPinning`, `BankConnectorRunbook`, `CertificateManagement`.
- Markdown sources in `docs/portal/` (quickstart, authentication, error-reference, webhooks, aisp/pisp guides) and `docs/public/quickstarts/`.
- `public/docs/snippets/auth-and-payments.md` covers cURL + Node + webhook verification.
- OpenAPI compliance gates already enforce ratchet/error catalog.

## What's missing — proposed additive work

### A. Multi-language SDK example pages (Standing Order P9)

Workspace already has Node + cURL + Python in places, but lacks consolidated **PHP, Java, Go, Ruby** runnable examples on the public docs site. Add:

- `docs/public/sdk-examples/typescript.md`
- `docs/public/sdk-examples/python.md`
- `docs/public/sdk-examples/php.md`
- `docs/public/sdk-examples/java.md`
- `docs/public/sdk-examples/go.md`
- `docs/public/sdk-examples/ruby.md`
- `docs/public/sdk-examples/index.md` (hub page)

Each: init client, create charge, retry/backoff, webhook signature verification.

Wire a new public route `src/pages/developer/SdkExamplesHub.tsx` (lists languages, links to existing `SDKsPage`) — public, no auth (Standing Order P1).

### B. Structured developer learning path landing

Add `src/pages/developer/LearningPath.tsx` at `/developer/learn` linking the existing pages in a 6-step flow (Quickstart → Auth → First Charge → Errors → Rate Limits → Idempotency). Pure presentational; no new endpoints.

### C. Connector Mode selection guide

Existing `BankConnectorRunbook.tsx` is operational. Add a **selection / decision** companion:

- `docs/public/connectors/mode-selection.md` (comparison matrix + decision flow for `connector_push`, `db_connector`, `connector_pull`, `file_feed`, `mq_realtime`, `hybrid`).
- `src/pages/developer/ConnectorModeSelection.tsx` rendering it.

### D. mTLS step-by-step setup guide (companion to existing AuthMtls/CertificateManagement)

- `docs/public/security/mtls-setup.md` — openssl CSR, upload, verify, renewal cron, language client snippets.
- Link from `AuthMtls.tsx` (no rewrite — add a "Setup walkthrough" link).

### E. SDK status / changelog page

- `src/pages/developer/SdkStatus.tsx` at `/developer/sdks/status` listing each SDK version, support matrix, roadmap (sourced from existing `packages/sdk-*` package metadata).

### F. Public route registration

Update `src/App.tsx` (or the developer routes file) to register the new pages, keeping the `// PERMANENT PUBLIC ROUTES — DO NOT REMOVE OR REDIRECT` block intact and ensuring all new routes are unauthenticated.

## What is intentionally NOT done

- No changes to `public/openapi.json`, `supabase/functions/*`, edge functions, schemas, or any operationId — Standing Orders 1, 2, 4.
- No new database tables.
- No SDK API changes; only added docs/examples.
- Items already shipped (RateLimits, Idempotency, Errors, Quickstart) get no rewrite.

## Verification

- `bunx vitest run src/test/openapi-2xx-schema-coverage.test.ts` and existing OpenAPI gate scripts must still pass (no spec changes expected).
- Visit each new `/developer/*` route logged-out → must render 200.
- Confirm `docs/public/**` files build into Netlify static output (no redirects).

## Open question

The prompt also references `docs/guides/00-quickstart.md` etc. We already have equivalents under `docs/portal/` and live `/developer` pages. Plan reuses those instead of duplicating, to avoid two sources of truth. Confirm this consolidation approach is acceptable, or say "create the `/docs/guides/` tree verbatim" and I will do that additively as well.
