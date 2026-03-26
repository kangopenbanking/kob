# Release Report — 2026-03-26

## Summary of what changed
- Fixed Send Abroad corridor loading for customer and banking apps.
- Kept all changes non-breaking and additive within approved manifest scope.

## Full file list changed/added
- **Changed:** `supabase/functions/remittance-outbound/index.ts`
- **Changed:** `src/pages/customer-app/CustomerSendMoney.tsx`
- **Changed:** `src/pages/banking-app/BankSendAbroad.tsx`
- **Added:** `docs/governance/CHANGE_MANIFEST.md`
- **Added:** `docs/reports/RELEASE_REPORT_2026-03-26.md`

## DB migrations applied
- None.

## Endpoint inventory added
- None.

## Dashboard pages added/updated
- Updated customer Send Money Abroad corridor loading state.
- Updated banking Send Abroad corridor loading state.

## Docs pages added/updated
- Added governance manifest.
- Added this release report.

## Test evidence

### API E2E
- Baseline DB audit confirmed active outbound corridors exist for `CM` origin.
- Root cause identified in backend function: `get_corridors` filtered by non-existent `status` column instead of `is_active`.
- Backend patched to filter by `is_active = true` and active partner status.

### UI E2E
- Customer page now throws and surfaces corridor-fetch errors instead of silently rendering a false empty state.
- Banking page now throws and surfaces corridor-fetch errors instead of silently rendering a false empty state.
- Search now matches more corridor metadata (country code/name, currency, partner).

### Webhook tests
- Not applicable for this fix.

### OpenAPI schema completeness test
- Not in scope for this targeted remediation.

### Postman run results
- Not in scope for this targeted remediation.

## Known limitations
- Direct authenticated edge-function invocation could not be executed from the current unauthenticated preview session.
- Full signed-in UI walkthrough depends on an authenticated app session.

## Next steps
- Verify `/app/...send money abroad` and `/bank/:institutionId/payments/send-abroad` while signed in to confirm corridor cards render live data.