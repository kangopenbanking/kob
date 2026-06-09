---
name: Admin Step-Up MFA Flow
description: Step-up MFA dialog + useStepUp wrapper used by all admin review pages to retry STEP_UP_REQUIRED actions
type: feature
---
- `useStepUp()` in `src/lib/step-up-client.ts` wraps any `supabase.functions.invoke(...)` call. On `STEP_UP_REQUIRED` (401 or body code), it opens `StepUpChallengeDialog` and re-runs the original call after successful TOTP `mfa.verify()`.
- Wired into: `KYCVerificationReview.tsx`, `BusinessKYCReview.tsx`, `InstitutionVerification.tsx`.
- Detection looks at both `data.code === 'STEP_UP_REQUIRED'` and `error.context.body` (string or object).
- Audit signals are surfaced in `/admin/audit-log-explorer` (quick filters: step_up_denied, manual_review, webhook).
- Webhook spike alerts are produced by edge function `webhook-health-rollup` (cron every 1m) and shown on `/admin/webhook-health`. Alert types: `webhook_manual_review_spike`, `step_up_denied_spike`, `webhook_correlation_failure_spike`.
