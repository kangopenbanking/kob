# CHANGE MANIFEST

## Baseline Fingerprint
- **Git commit hash:** `5554bc83033a044db3bccdfd05afa6cbee204442`
- **Context ID:** `8F42B1C3-5D9E-4A7B-B2E1-9C3F4D5A6E7B`
- **Current issue:** Public remittance send confirmation fails with **"Edge Function returned a non-2xx status code"** when submitting a transfer from the `/remittance` flow.

## Existing Routes (summary)
- **Public remittance:** `/remittance`
- **Customer app:** `/app/*` with send-abroad experience in `CustomerSendMoney`
- **Banking app:** `/bank/:institutionId/*` with send-abroad experience in `BankSendAbroad`
- **Admin remittance governance:** `/admin/remittance-partners`, `/admin/remittance-outbound`

## Existing OpenAPI spec file paths
- `supabase/functions/public-api-spec/index.ts`
- `supabase/functions/openapi-json/index.ts`

## Existing Postman paths
- `supabase/functions/postman-collection/index.ts`
- `docs/audit/postman-endpoint-inventory.md`

## Existing dashboards/pages inventory
- **Customer app page:** `src/pages/customer-app/CustomerSendMoney.tsx`
- **Banking app page:** `src/pages/banking-app/BankSendAbroad.tsx`
- **Public remittance hero flow:** `src/components/remittance/HeroSendForm.tsx`
- **Backend function powering send-abroad:** `supabase/functions/remittance-outbound/index.ts`

## Scope of Work (Explicit)

### Feature name
Public remittance send confirmation fix

### Why needed
Users can reach the transfer confirmation step but the transfer submission fails because the remittance backend send path is using an invalid insert payload and the client can resolve a corridor too loosely for the chosen source/destination pair.

### Exact modules impacted
- `supabase/functions/remittance-outbound/index.ts`
- `src/components/remittance/HeroSendForm.tsx`

### Exact files expected to change/add
**Change:**
- `supabase/functions/remittance-outbound/index.ts`
- `src/components/remittance/HeroSendForm.tsx`

**Add:**
- `docs/governance/CHANGE_MANIFEST.md`
- `docs/reports/RELEASE_REPORT_2026-03-26.md`

### DB changes
- None. **Additive-only data/code audit. No schema changes.**

### New endpoints
- None.

### Dashboard pages impacted/added
- Impacted only:
  - Public `/remittance` send-money hero flow

### Docs pages added/updated
- Add release report documenting audit results and fix evidence.

### Tests added
- No permanent test files planned.
- E2E verification will be run against the affected backend function and UI flows.

### Acceptance criteria
- Confirming a transfer from `/remittance` no longer returns a non-2xx edge function response for a valid authenticated request.
- `remittance-outbound` inserts remittance records using only valid schema fields.
- The client resolves the corridor using the selected source country/currency and destination country/currency, not destination alone.
- No existing endpoint response shape changes.

### Rollback strategy
- Revert only the touched files listed above.
- Since there are no schema changes, rollback is code-only and immediate.

## Allowed Change Types
- **Default:** additive / non-breaking bug fix only.
- No breaking changes approved.

## BREAKING CHANGE REQUEST
- **Not requested. Not approved. Do not perform.**

## E2E Test Gates

### API E2E tests
- Invoke `remittance-outbound` `send` with an authenticated request and a valid corridor to verify a successful non-2xx regression fix.
- Verify response objects still contain remittance identifier and partner reference fields expected by the client.

### UI E2E tests
- Verify `/remittance` resolves the correct corridor for the selected source, destination, and method.
- Verify the confirm action no longer fails for a valid transfer path.

### Webhook tests
- Not applicable for this scoped fix.

### Admin workflow test
- Verify admin-seeded corridors remain selectable in the `/remittance` flow through backend-backed corridor resolution.

### Docs validation test
- Ensure release report is generated and references the audited route/function pair.