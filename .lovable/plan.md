

# Fix 19 USING(true) / WITH CHECK(true) RLS Policy Warnings

## Problem

The database linter found 19 policies on non-SELECT operations that use `USING(true)` or `WITH CHECK(true)`, making them overly permissive. These fall into three categories:

## Analysis of All 19 Policies

### Category 1: Service-role policies (redundant -- service_role bypasses RLS)
These can simply be **dropped** since the `service_role` always bypasses RLS:

| Table | Policy Name | Operation |
|---|---|---|
| `audit_logs` | "Only service role can insert audit logs" | INSERT |
| `captcha_challenges` | "Service role can manage captcha challenges" | ALL |
| `captcha_challenges` | "Service role only access" | ALL |
| `woocommerce_transactions` | "Service role manages transactions" | ALL |

### Category 2: Public-role policies that should require `service_role` auth
These are called by edge functions but incorrectly grant access to the anonymous/public role. Fix: replace `WITH CHECK (true)` with `WITH CHECK (auth.role() = 'service_role')`:

| Table | Policy Name | Operation |
|---|---|---|
| `api_health_metrics` | "Service role can insert health metrics" | INSERT |
| `communication_logs` | "System can insert communication logs" | INSERT |
| `credit_api_usage_logs` | "System can create usage logs" | INSERT |
| `credit_inquiries` | "System can create inquiries" | INSERT |
| `credit_monitoring_alerts` | "System can create alerts" | INSERT |
| `credit_reports` | "System can create credit reports" | INSERT |
| `credit_score_history` | "System can create history" | INSERT |
| `credit_scores` | "System can create credit scores" | INSERT |
| `credit_scores` | "System can update credit scores" | UPDATE |
| `external_credit_data_cache` | "System can manage cache" | ALL |
| `idempotency_keys` | "Service role full access on idempotency_keys" | ALL |
| `sca_challenges` | "System can create SCA challenges" | INSERT |
| `security_audit_logs` | "System can insert audit logs" | INSERT |
| `suspicious_activities` | "System can insert suspicious activities" | INSERT |
| `system_health_checks` | "System can insert health checks" | INSERT |
| `webhook_inbox` | "Service role full access on webhook_inbox" | ALL |

### Category 3: Legitimate public INSERT (keep but tighten)
| Table | Policy Name | Fix |
|---|---|---|
| `api_demo_logs` | "Anyone can log api demo usage" | Keep -- this is intentionally public for demo API |
| `enterprise_leads` | "Anyone can submit enterprise leads" | Keep -- public lead form |

### Category 4: Authenticated but too broad
| Table | Policy Name | Fix |
|---|---|---|
| `consent_events` | "Service role can insert consent events" | Restrict to `auth.role() = 'service_role'` |

## Migration SQL

A single migration will:

1. **DROP** 4 redundant service_role policies (Category 1)
2. **DROP and RECREATE** 16 public-role policies with `auth.role() = 'service_role'` check (Category 2 + 4)
3. **Leave** 2 intentionally-public policies unchanged but mark as accepted (Category 3)

This reduces warnings from 19 to 2 (the two intentionally public insert tables).

## Technical Details

- No code changes needed -- edge functions already use the service role key
- No functional impact -- edge functions authenticate as `service_role` which matches the new check
- The 2 remaining public INSERT policies (`api_demo_logs`, `enterprise_leads`) are intentional and acceptable

## Files Modified

- One new migration file in `supabase/migrations/`
- No application code changes

