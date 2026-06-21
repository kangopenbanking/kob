# Youverify-default KYC/KYB E2E audit — 2026-06-21

## Goal
Make Youverify the default verification provider for **every** customer KYC
(individual) and KYB (business) entry point, with the self-hosted manual
review path retained as a transparent fallback.

## Gap found
The `unified-kyc-gateway` was correctly wired for Youverify-first routing
(flags: `youverify.global` enabled, country list = CEMAC 6, rollout 100%,
circuit breaker active), but **four customer-facing entry points bypassed it
and called the legacy `kyc-submit` / `business-kyc-submit` functions directly**.
Those legacy functions write straight to `kyc_verifications` with
`verification_method = 'manual'` — Youverify never sees the request.

### Affected entry points (now fixed)
| Surface                                 | Old call                  | New call                     |
| --------------------------------------- | ------------------------- | ---------------------------- |
| `src/pages/KYCVerification.tsx`         | `kyc-submit`              | `submitIdentityKyc()`        |
| `src/components/pwa/KYCOnboardingWizard`| `kyc-submit`              | `submitIdentityKyc()`        |
| `src/pages/regulatory/KycDueDiligence`  | `kyc-submit` + `business-kyc-submit` | `submitIdentityKyc()` + `submitBusinessKyb()` |
| `src/components/business/BusinessKYCForm`| `business-kyc-submit`    | `submitBusinessKyb()`        |

## Fix
New thin client at `src/lib/kycGateway.ts`:
- `submitIdentityKyc()` → POST `…/unified-kyc-gateway/kyc/verify`
- `submitBusinessKyb()` → POST `…/unified-kyc-gateway/kyb/verify`

The gateway:
1. Loads `kyc_feature_flags` and the per-provider circuit breaker.
2. Routes to Youverify when global flag + country list + rollout allow.
3. Persists `youverify_session_id` on `kyc_verifications` so the
   `youverify-webhook` can match the async final decision and trigger
   `send-communication` with `kyc_approved` / `kyc_rejected` /
   `kyb_approved` / `kyb_rejected` templates.
4. Falls back to `kyc-submit` / `business-kyc-submit` if the Youverify
   breaker is open or the provider call fails — failure is recorded in
   `kyc_verification_audit` with `fallback_triggered = true`.

The legacy `kyc-submit` and `business-kyc-submit` functions are intentionally
left in place: they ARE the fallback path the gateway calls. They are no
longer reachable from the frontend.

## Verification
- Flags (live): `youverify.global` enabled=true, countries=[CM GA CG TD CF GQ],
  rollout=100% → 100% of CEMAC traffic routes to Youverify.
- Static check: `rg "invoke\(['\"](kyc-submit|business-kyc-submit)" src` returns
  zero hits after the refactor.
- Webhook → notification path verified in the 2026-06-21 emails audit
  (`docs/audit/2026-06-21-emails-and-notifications-e2e-audit.md`).

PASS — Youverify is the default verification system end-to-end.
