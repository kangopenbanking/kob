---
name: Nium BEAC compliance locks
description: Hardcoded PoP codes, KYC-name-only beneficiary, double-spread FX preview, additive-only deprecation for legacy VA endpoints
type: constraint
---
- BEAC PoP whitelist (Règlement 02/18/CEMAC/UMAC/CM): only `Software/Digital Services` and `Royalties`. Source of truth: `src/constants/nium-compliance.ts` + `supabase/functions/_shared/nium-compliance.ts`. Never add generic codes (`Transfer`, `Consulting`, etc.).
- `nium-create-global-account` MUST reject any `beneficiary_name` in the body (400 `beneficiary_name_override_forbidden`) and pull the name from `profiles.full_name` (verified KYC).
- FX/fee math lives in `supabase/functions/_shared/nium-fx.ts` and is shared by `nium-webhook` and `nium-quote-payout` — they must never drift.
- Customer App `/app/global-accounts` must always show the non-dismissible exact-name `Alert` + PoP picker + `TransactionPreview` before any cash-out preference change.
- Legacy `/v1/gateway/virtual-accounts*` operations are `deprecated: true` with `x-sunset: 2027-01-01`. Do not remove operationIds or paths before then (Standing Order 1).
