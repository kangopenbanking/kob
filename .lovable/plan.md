

## Fee Management Audit — Identified Gaps and Fix Plan

### Audit Summary

After a thorough review of the `/admin/fee-management` page, all 7 tabs (Structures, Fees, Invoices, Waivers, Analytics, Limits, Merchants), the backend edge functions (`gateway-fee-estimate`, `gateway-create-funding-intent`, `generate-invoice`), the shared fee engine (`gateway-adapters.ts`), the client-side hook (`useFeeEstimate`), database schema, and RLS policies, I found **6 functional gaps** that prevent the fee system from working correctly end-to-end.

---

### Gap 1: RLS blocks fee lookups for regular users (Critical)

**Problem:** The `fee_structures` table has RLS enabled but the only SELECT policy for non-admins requires `institution_id IN (user's institutions)`. Platform-scoped structures (`institution_id = NULL`) and merchant-scoped structures are invisible to personal/customer users. This means the `useFeeEstimate` hook used by all PWA funding pages (Bank, Customer, Institution, Merchant) silently fails and falls back to hardcoded rates, completely ignoring admin-configured fees.

**Fix:** Add a SELECT policy allowing all authenticated users to read `is_active = true` fee structures. Fee rates are not sensitive data — they need to be visible for real-time fee display.

---

### Gap 2: No platform-scope option in the Create Structure form

**Problem:** The `CreateFeeStructureForm` requires selecting an institution. There is no way to create a platform-wide default fee structure (where `fee_scope = 'platform'` and `institution_id = NULL`). The 12 existing platform structures were likely seeded manually. Admins cannot update or create new platform defaults through the UI.

**Fix:** Add a "Platform Default" option to the Institution selector in the form. When selected, set `fee_scope = 'platform'` and `institution_id = null`. Otherwise keep `fee_scope = 'institution'`.

---

### Gap 3: Transaction fees are never recorded (Data gap)

**Problem:** The `transaction_fees` table has 0 rows. No edge function or trigger writes to this table when real transactions occur. The `generate-invoice` RPC sums `transaction_fees` to produce invoices — since there are no rows, every invoice generates with `total_transactions = 0` and `total_amount = 0`. This breaks the Fees tab, Analytics tab, and Invoice generation entirely.

**Fix:** Add a helper function in `gateway-adapters.ts` (or a dedicated utility) that records a `transaction_fees` row after every successful gateway charge and funding intent. Call it from `gateway-create-charge`, `gateway-create-funding-intent`, and other transaction-producing functions. Columns to populate: `institution_id`, `transaction_type`, `transaction_amount`, `transaction_currency`, `transaction_date`, `transaction_ref`, `fee_structure_id`, `calculated_fee`, `waived_amount`, `final_fee`, `billing_status = 'pending'`.

---

### Gap 4: `fee_limits_charges` not in TypeScript types (Type safety)

**Problem:** The `LimitsChargesTab` component casts `supabase.from("fee_limits_charges" as any)` because the table is not in the auto-generated types file. This loses type safety and autocomplete.

**Fix:** This is a known limitation — the types file auto-generates from the schema. Since we cannot edit `types.ts` directly, the `as any` cast is the correct workaround. No action needed, but noted for awareness.

---

### Gap 5: `useFeeEstimate` doesn't check `effective_until` expiry

**Problem:** The client-side `useFeeEstimate` hook queries `fee_structures` but does not filter out expired structures (where `effective_until < today`). The backend `calculateGatewayFee` does check this on line 669. This mismatch means the PWA could display an expired fee rate while the API charges a different (fallback) rate.

**Fix:** Add `.or('effective_until.is.null,effective_until.gte.' + today)` to the query in `useFeeEstimate`.

---

### Gap 6: Invoice generation doesn't handle empty fee data gracefully

**Problem:** When `generate-invoice` is called and there are no `transaction_fees` rows (Gap 3), the `generate_institution_invoice` RPC creates an invoice with `total_transactions = 0` and `total_amount = 0`. The UI allows generating these empty invoices without warning.

**Fix:** Add a pre-check in the `generate-invoice` edge function: query pending transaction_fees count before calling the RPC. Return an informative error if no pending fees exist for the selected period.

---

### Implementation Plan

1. **Database migration**: Add a new RLS SELECT policy on `fee_structures` for authenticated users to read active structures
2. **Update CreateFeeStructureForm**: Add "Platform Default (all institutions)" option; set `fee_scope` and `institution_id` accordingly
3. **Update FeeManagement.tsx**: Pass `fee_scope` through to the insert call
4. **Create `recordTransactionFee` utility**: Shared function for edge functions to write to `transaction_fees` after successful transactions
5. **Wire fee recording into `gateway-create-charge` and `gateway-create-funding-intent`**: Call the utility after successful processing
6. **Fix `useFeeEstimate`**: Add `effective_until` expiry filter
7. **Add empty-data guard to `generate-invoice`**: Return error when no pending fees exist
8. **Test all tabs end-to-end**: Verify Structures CRUD, fee estimation on PWA pages, invoice generation with real fee data, waivers application, analytics charts, and merchant overrides

