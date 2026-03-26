# CHANGE MANIFEST

## Baseline Fingerprint
- **Git commit hash:** `5554bc83033a044db3bccdfd05afa6cbee204442`
- **Context ID:** `8F42B1C3-5D9E-4A7B-B2E1-9C3F4D5A6E7B`
- **Current issue:** Send Money Abroad surfaces **"No corridors available"** despite corridor records existing in the backend.

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
Send Abroad corridor availability restoration

### Why needed
The customer and banking Send Money Abroad flows show an empty corridor state even though corridor data exists in the database, blocking outbound remittance initiation.

### Exact modules impacted
- `supabase/functions/remittance-outbound/index.ts`
- `src/pages/customer-app/CustomerSendMoney.tsx`
- `src/pages/banking-app/BankSendAbroad.tsx`

### Exact files expected to change/add
**Change:**
- `supabase/functions/remittance-outbound/index.ts`
- `src/pages/customer-app/CustomerSendMoney.tsx`
- `src/pages/banking-app/BankSendAbroad.tsx`

**Add:**
- `docs/governance/CHANGE_MANIFEST.md`
- `docs/reports/RELEASE_REPORT_2026-03-26.md`

### DB changes
- None. **Additive-only data/code audit. No schema changes.**

### New endpoints
- None.

### Dashboard pages impacted/added
- Impacted only:
  - Customer Send Money Abroad flow
  - Banking Send Abroad flow

### Docs pages added/updated
- Add release report documenting audit results and fix evidence.

### Tests added
- No permanent test files planned.
- E2E verification will be run against the affected backend function and UI flows.

### Acceptance criteria
- `remittance-outbound` returns outbound corridors when active corridors exist.
- Customer app Send Money Abroad no longer shows false empty-state for available corridors.
- Banking app Send Abroad no longer shows false empty-state for available corridors.
- Corridor filtering/search still works.
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
- Invoke `remittance-outbound` `get_corridors` path with authenticated context and verify non-empty outbound result set.
- Verify response objects still contain corridor identifiers and partner metadata expected by current clients.

### UI E2E tests
- Verify customer Send Money Abroad corridor list renders available destinations.
- Verify banking Send Abroad corridor list renders available destinations.
- Verify search/filter does not incorrectly hide all results for valid destinations.

### Webhook tests
- Not applicable for this scoped fix.

### Admin workflow test
- Verify admin-seeded corridors remain visible in app flows via backend fetch.

### Docs validation test
- Ensure release report is generated and references the audited route/function pair.