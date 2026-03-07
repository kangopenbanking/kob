

## Analysis: Limits & Charges vs Fee Structures

The two systems serve **overlapping but distinct** purposes:

| Capability | Fee Structures | Limits & Charges |
|---|---|---|
| Fee calculation (%, fixed, tiered) | Yes (primary) | Yes (fallback, Step 2) |
| Min/max fee caps | Yes (`min_fee`, `max_fee`) | Yes (`min_amount`, `max_amount`, `max_charge_cap`) |
| Daily/monthly transaction limits | No | Yes |
| Agent commissions | No | Yes |
| Referral commissions | No | Yes |
| Merchant surcharges | No | Yes (`merchant_percent_charge`, `merchant_fixed_charge`) |
| Multi-scope (platform/institution/merchant) | Yes | No (single global config) |

**Conclusion:** The Limits & Charges table (`fee_limits_charges`) **cannot be fully removed** because it provides functionality that fee structures don't cover — specifically **daily/monthly transaction limits**, **agent commissions**, **referral commissions**, and **merchant surcharges**. The backend fee engine (`gateway-adapters.ts`) uses it as Step 2 in the resolution chain, and `limits-enforcement.ts` reads daily/monthly limits from it for transaction validation.

### Recommended Approach: Consolidate, Don't Remove

Instead of removing Limits & Charges, **merge its unique fields into fee structures** so there's a single source of truth, then remove the redundant table and tab.

### Plan

1. **Database migration** — Add columns to `fee_structures`: `daily_limit`, `monthly_limit`, `max_charge_cap`, `agent_commission_percent`, `agent_commission_fixed`, `referral_percent_commission`, `referral_fixed_commission`, `merchant_percent_charge`, `merchant_fixed_charge`. Migrate existing `fee_limits_charges` values into matching `fee_structures` rows.

2. **Update the Create/Edit Fee Structure form** — Add an optional "Limits & Commissions" section (collapsible) on Step 3 for daily/monthly limits, agent commissions, referral commissions, and merchant surcharges.

3. **Update `gateway-adapters.ts`** — Remove Step 2 (`fee_limits_charges` lookup). Pull limits and commission fields from the resolved `fee_structures` row instead. Update the `EnforcedLimits` construction to use fee_structures data.

4. **Update `useFeeEstimate.ts`** — Remove the `fee_limits_charges` fallback query. Return limits from the resolved fee structure.

5. **Update `limits-enforcement.ts`** — No changes needed (it receives limits as parameters, doesn't query directly).

6. **Remove `LimitsChargesTab.tsx`** — Delete the component and remove its tab from `FeeManagement.tsx`.

7. **Remove the "Limits" tab** from the Fee Management page tabs list.

8. **Update `FeeStructuresTable.tsx`** — Show daily/monthly limit badges on cards where configured.

This consolidates everything into one admin interface and one resolution path, making fee governance simpler and eliminating the confusing dual-system.

