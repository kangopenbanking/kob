# Unified KYC Gateway — Youverify Primary, Self-Hosted Fallback

## Overview

The Unified KYC Gateway is the single entry point for all individual KYC, business KYB, and AML screening operations. It routes to **Youverify** by default and gracefully falls back to the existing **self-hosted KOB KYC module** when Youverify is unavailable.

```
Client (mobile / web / PWA)
        │
        ▼
 unified-kyc-gateway  ──►  YouverifyAdapter ──► Youverify API
        │                        │
        │              (timeout / 5xx / 429 / circuit open)
        │                        ▼
        └──────────────►  SelfHostedAdapter ──► kyc-submit / business-kyc-submit / gateway-compliance-screen
                                 │
                                 ▼
                         kyc_verification_audit
```

The existing self-hosted KYC functions are **not modified**. The gateway invokes them with the same payload they already accept.

## Routes

| Method | Path | Purpose |
|---|---|---|
| POST | `/unified-kyc-gateway/kyc/verify` | Individual KYC |
| POST | `/unified-kyc-gateway/kyb/verify` | Business KYB |
| POST | `/unified-kyc-gateway/aml/screen`  | AML screening |
| GET  | `/unified-kyc-gateway/kyc/status/:user_id` | Latest verification status |

Full URL: `https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/unified-kyc-gateway/...`

Supporting endpoints:

| Method | Path | Purpose |
|---|---|---|
| POST | `/youverify-webhook` | Async verification completion (HMAC-verified, idempotent) |
| GET  | `/kyc-health` | Provider status + circuit state + last-hour metrics |
| GET  | `/kyc-config` | Public-safe flags for mobile/PWA bootstrap |

## Feature Flags (`kyc_feature_flags` table)

| Flag key | Effect |
|---|---|
| `youverify.global` | Master on/off switch. **Defaults to `false`** — first deploy changes nothing. |
| `youverify.rollout` | `rollout_percentage` (0–100) of traffic routed to Youverify via consistent hash on `user_id`. `user_whitelist` always routes. |
| `youverify.countries` | Country allowlist (ISO-2). Defaults to `{CM, GA, CG, TD, CF, GQ}`. |

Flags are cached for 60 s in the edge function — no redeploy needed to toggle.

### Enable Youverify (operator workflow)

```sql
-- 1. Pilot: 5% rollout in Cameroon
UPDATE public.kyc_feature_flags
   SET is_enabled = true, rollout_percentage = 5, country_codes = ARRAY['CM']
 WHERE flag_key = 'youverify.global';

UPDATE public.kyc_feature_flags
   SET is_enabled = true, rollout_percentage = 5
 WHERE flag_key = 'youverify.rollout';

-- 2. Promote to 100% once metrics look good
UPDATE public.kyc_feature_flags
   SET rollout_percentage = 100
 WHERE flag_key = 'youverify.rollout';
```

### Rollback to self-hosted only

```sql
UPDATE public.kyc_feature_flags SET is_enabled = false WHERE flag_key = 'youverify.global';
```

Effect is global within 60 seconds (cache TTL). No deploy.

## Circuit Breaker

| Parameter | Value |
|---|---|
| Failure threshold | 5 failures within 30 s |
| Open duration | 60 s |
| Half-open | One probe call; success → closed, failure → open again |

State is persisted in `kyc_circuit_breaker_state` so it survives cold starts.

## When the gateway falls back to self-hosted

| Trigger | Fallback |
|---|---|
| Youverify HTTP 5xx | Yes |
| Youverify timeout (30 s) | Yes |
| Youverify HTTP 429 (rate limited) | Yes |
| Circuit breaker `open` | Yes |
| Network / DNS error | Yes |
| Youverify HTTP 400 (validation) | **No** — returned as `rejected` |
| Youverify HTTP 401 (auth) | **No** — surfaces immediately, alerts ops |
| Youverify clear `rejected` result | **No** — Youverify decision honored |

## Audit (`kyc_verification_audit`)

Every attempt writes one row with: `trace_id`, `user_id`, `verification_type`, `provider_used`, `fallback_triggered`, `fallback_reason`, response times for each provider, `verification_result`, `risk_score`, error code/message.

PII (names, document numbers, image URLs) is **not** written to logs or audit columns.

## Mobile apps (no changes required)

Customer app, Banking Staff app, and Business PWA continue to call the existing KYC endpoints. To migrate an endpoint behind the gateway, change the inner call from invoking `kyc-submit` directly to invoking `unified-kyc-gateway/kyc/verify`. Request/response contracts are preserved.

Recommended mobile-side changes (optional, non-breaking):

1. Bump KYC HTTP timeout from 30 s to 45 s.
2. On launch, fetch `GET /kyc-config` and log `provider_default` for observability only.
3. Surface a single generic error to users; the gateway already handles provider failover transparently.

## Deployment & rollback

| Action | Steps |
|---|---|
| **Deploy** | Migration auto-applies; new edge functions auto-deploy. Flags ship disabled. |
| **Enable** | Update `kyc_feature_flags` rows (see SQL above). |
| **Disable** | Set `youverify.global.is_enabled = false`. |
| **Hard rollback** | Drop new tables — existing self-hosted KYC continues to work because nothing in the old code path was modified. |

## Secrets required

| Name | Where used |
|---|---|
| `YOUVERIFY_API_KEY` | `unified-kyc-gateway`, `kyc-health` |
| `YOUVERIFY_WEBHOOK_SECRET` | `youverify-webhook` |
| `YOUVERIFY_BASE_URL` | `unified-kyc-gateway`, `kyc-health` (e.g. `https://api.sandbox.youverify.co` or `https://api.youverify.co`) |

## Tests

See `supabase/functions/unified-kyc-gateway/index_test.ts` for circuit-breaker, transformer, and rollout-hash unit tests. Run via `supabase--test_edge_functions`.
