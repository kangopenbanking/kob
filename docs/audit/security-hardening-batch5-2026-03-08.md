# Kang Open Banking — Security Hardening Batch 5

**Date:** 2026-03-08  
**Scope:** Fix all remaining permissive RLS policies, broken policy conditions, edge function gaps

---

## Summary

| Category | Before | After |
|----------|--------|-------|
| Linter Warnings | 23 | 1 (pgcrypto in public — required) |
| Critical Data Exposures | 5 tables exposed to anon | 0 |
| Privilege Escalation | 1 (credit_scores) | 0 |
| Broken Policy Conditions | 3 (self-referential) | 0 |
| Function Search Path | 1 mutable | 0 |
| Edge Function CORS | 85 with local headers | 84 (1 fixed, bulk noted) |

---

## Fixes Applied

### 1. CRITICAL: Policies Exposing Data to Anonymous Users (→ service_role)

These policies were on `{public}` role with `USING(true)` / `WITH CHECK(true)`, meaning **unauthenticated users** could read/write sensitive data:

| Table | Policy | Risk | Fix |
|-------|--------|------|-----|
| `funding_intents` | Service role full access | Stripe PaymentIntent secrets exposed | Moved to `{service_role}` |
| `funding_events` | Service role full access | Payment event data exposed | Moved to `{service_role}` |
| `external_credit_data_cache` | System can manage cache | Raw credit bureau data R/W | Moved to `{service_role}` + user SELECT |
| `webhook_inbox` | Service role full access | Provider webhook payloads exposed | Moved to `{service_role}` |
| `idempotency_keys` | Service role full access | API response bodies exposed | Moved to `{service_role}` |
| `credit_scores` | System can create/update | Any user could overwrite any score | Moved to `{service_role}` |
| `credit_inquiries` | System can create | Fabricate hard inquiries for others | Moved to `{service_role}` |
| `credit_reports` | System can create | Fabricate credit reports | Moved to `{service_role}` |
| `credit_score_history` | System can create | Fabricate score history | Moved to `{service_role}` |
| `credit_monitoring_alerts` | System can create | Fabricate monitoring alerts | Moved to `{service_role}` |
| `api_health_metrics` | Service role insert | Anon could flood metrics | Moved to `{service_role}` |
| `communication_logs` | System insert | Anon could insert logs | Moved to `{service_role}` |
| `consent_events` | Service role insert | Open insert | Moved to `{service_role}` |
| `credit_api_usage_logs` | System create | Open insert | Moved to `{service_role}` |
| `app_notifications` | Service role insert | Open insert | Moved to `{service_role}` + user-scoped |
| `sca_challenges` | System create | Anon could flood challenges | Moved to `{service_role}` |
| `security_audit_logs` | System insert | Anon could insert audit logs | Moved to `{service_role}` |
| `suspicious_activities` | System insert | Anon could insert records | Moved to `{service_role}` |
| `system_health_checks` | System insert | Anon could flood health checks | Moved to `{service_role}` |
| `api_demo_logs` | Anyone can log (CHECK true) | No validation | Added field validation |

### 2. Broken Self-Referential Policy Conditions

| Table | Bug | Impact | Fix |
|-------|-----|--------|-----|
| `njangi_contributions` | `nm.group_id = nm.group_id` (always true) | Any member reads ALL groups' contributions | Fixed to `nm.group_id = njangi_contributions.group_id` |
| `njangi_payouts` | `nm.group_id = nm.group_id` (always true) | Any member reads ALL groups' payouts | Fixed to `nm.group_id = njangi_payouts.group_id` |
| `pos_products` | `sp.merchant_id = sp.merchant_id` (always true) | Products from unpublished stores visible | Fixed to `sp.merchant_id = pos_products.merchant_id` |

### 3. Function Search Path

| Function | Fix |
|----------|-----|
| `update_pos_updated_at` | Added `SET search_path TO 'public'` |

### 4. Edge Function Fixes

| Function | Issue | Fix |
|----------|-------|-----|
| `gateway-cancel-subscription` | Local CORS headers missing platform headers | Switched to `_shared/cors.ts` import |
| `gateway-cancel-funding-intent` | Unused `account_id` extracted from body | Removed dead code |

### 5. Remaining (By-Design)

- **22 `{service_role}` policies with `USING(true)`**: These are correctly scoped — only the service role key (used by edge functions) can access them. The anon key cannot elevate.
- **pgcrypto in public schema**: Required for hashing functions (`hash_secret_value`, `compute_webhook_hmac`, etc.)
- **85 edge functions with local CORS**: Noted for future bulk migration to `_shared/cors.ts`

---

## Verification

- Security linter: **1 warning** (pgcrypto extension — required)
- All critical/error-level findings from security scan: **Resolved**
- All broken self-referential conditions: **Fixed**
- All function search paths: **Set**
