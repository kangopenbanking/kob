# KOB v1 Core Protection Policy
> Effective: 2026-03-08 | Classification: MANDATORY

## Purpose

This policy enforces strict protection of the Kang Open Banking v1 core infrastructure to prevent regressions, breaking changes, and security degradation. **All future changes MUST comply with this policy.**

---

## 1. Protected Core — DO NOT MODIFY

The following components are classified as **FROZEN CORE**. They must not be modified unless a critical security vulnerability or data-loss bug is identified.

### 1.1 Database Functions (PL/pgSQL)

| Function | Domain | Risk if Modified |
|---|---|---|
| `execute_atomic_transfer` | Ledger | Double-spending, balance drift |
| `check_transfer_idempotency` | Ledger | Duplicate transactions |
| `atomic_charge_wallet_credit` | Gateway Wallets | Wallet balance corruption |
| `atomic_refund_wallet_debit` | Gateway Wallets | Refund balance corruption |
| `atomic_dispute_wallet_adjust` | Gateway Wallets | Dispute balance corruption |
| `calculate_transaction_fee` | Fee Engine | Incorrect billing |
| `calculate_settlement_balance` | Settlements | Settlement mismatch |
| `record_transaction_fee` | Fee Engine | Fee recording failure |
| `generate_institution_invoice` | Billing | Invoice corruption |
| `check_rate_limit` | Security | Rate limit bypass |
| `has_role` | RBAC | Privilege escalation |
| `has_permission` | RBAC | Authorization bypass |
| `hash_secret_value` | Security | Credential compromise |
| `compute_webhook_hmac` | Webhooks | Signature forgery |
| `verify_sandbox_credentials` | Auth | Sandbox bypass |
| `check_suspicious_login` | Security | Fraud detection failure |
| `log_security_event` | Audit | Audit trail gaps |
| `handle_new_user` | Onboarding | User creation failure |
| `assign_default_personal_role` | RBAC | Missing role assignment |

### 1.2 Shared Utilities (Edge Functions)

| File | Purpose |
|---|---|
| `_shared/cors.ts` | CORS header governance |
| `_shared/security.ts` | Rate limiting, token gen, hashing |
| `_shared/gateway-adapters.ts` | Provider abstraction layer |

### 1.3 Core Edge Functions

| Function | Domain | Reason |
|---|---|---|
| `oauth-token` | OAuth 2.0 | Token issuance — any change breaks all API consumers |
| `oauth-introspect` | OAuth 2.0 | Token validation — breaks resource servers |
| `oauth-revoke` | OAuth 2.0 | Token lifecycle |
| `oauth-authorize` | OAuth 2.0 | Authorization flow |
| `api-transfers` | Banking Core | Fund movement engine |
| `process-transaction` | Banking Core | Transaction processing |
| `gateway-create-charge` | Gateway | Payment collection |
| `gateway-create-payout` | Gateway | Disbursement |
| `gateway-deliver-webhook` | Gateway | Webhook delivery |
| `gateway-settlement-cron` | Gateway | Settlement processing |
| `gateway-reconcile-stuck` | Gateway | Transaction recovery |
| `gateway-subscription-charge-cron` | Gateway | Recurring billing |
| `mobile-money-charge` | MoMo | Mobile money collections |
| `mobile-money-webhook` | MoMo | Provider callbacks |
| `flutterwave-webhook` | Provider | Payment confirmations |
| `stripe-webhook` | Provider | Card payment callbacks |

### 1.4 Client Infrastructure

| File | Reason |
|---|---|
| `src/integrations/supabase/client.ts` | Auto-generated — never edit |
| `src/integrations/supabase/types.ts` | Auto-generated — never edit |
| `src/components/RoleGuard.tsx` | RBAC enforcement gate |
| `supabase/config.toml` | Auto-managed configuration |

---

## 2. Change Classification System

All changes to KOB v1 MUST be classified before implementation:

### Class A — Safe (No review needed)
- New edge functions with new routes
- New database tables with RLS
- New frontend pages/components
- New shared utilities (not modifying existing)
- Documentation updates

### Class B — Caution (Impact assessment required)
- Adding columns to existing tables (must have defaults, must be nullable)
- Adding new methods to existing edge functions (GET added to POST-only)
- Modifying frontend routing (App.tsx, navigation configs)
- Adding new RLS policies to existing tables

### Class C — Restricted (Critical review required)
- Modifying request/response contracts of existing endpoints
- Changing database function signatures
- Modifying shared utilities (`_shared/*`)
- Changing authentication/authorization flows
- Modifying webhook signature verification

### Class D — Forbidden (Requires security incident justification)
- Removing database columns or tables
- Removing or renaming edge functions
- Modifying `has_role`, `has_permission`, or `check_rate_limit`
- Changing token hashing algorithms
- Removing RLS policies
- Modifying atomic balance functions

---

## 3. Mandatory Pre-Change Checklist

Before ANY code change to a Class B or higher component:

```
□ 1. Identify all dependent components (upstream + downstream)
□ 2. Verify change is backward-compatible (old clients still work)
□ 3. Confirm no request/response contract changes
□ 4. Confirm no RLS policy removals or weakening
□ 5. Confirm no database column removals
□ 6. Verify idempotency is preserved where applicable
□ 7. Verify CORS headers use shared utility
□ 8. Verify error responses follow RFC 7807
□ 9. Confirm audit logging is maintained
□ 10. Test: existing Postman collection passes
```

---

## 4. Safe Extension Patterns

### 4.1 Adding a New Gateway Feature
```
✅ DO: Create new edge function → new route → new table if needed
✅ DO: Import existing shared utilities
✅ DO: Follow existing patterns (auth, CORS, error format)
❌ DON'T: Modify existing gateway functions
❌ DON'T: Change existing table schemas
❌ DON'T: Override shared utility behavior
```

### 4.2 Adding a New Banking Feature
```
✅ DO: Create new edge function under appropriate namespace
✅ DO: Use execute_atomic_transfer for fund movements
✅ DO: Implement idempotency via check_transfer_idempotency
❌ DON'T: Write custom balance update logic
❌ DON'T: Bypass the fee engine
❌ DON'T: Skip audit logging
```

### 4.3 Adding a New Admin Feature
```
✅ DO: Add new admin page component
✅ DO: Use RoleGuard with appropriate roles
✅ DO: Add route to App.tsx
❌ DON'T: Modify RoleGuard logic
❌ DON'T: Add admin checks via localStorage
❌ DON'T: Hardcode credentials
```

---

## 5. Database Migration Rules

| Action | Allowed? | Condition |
|---|---|---|
| `CREATE TABLE` | ✅ Yes | Must include RLS policies |
| `ALTER TABLE ADD COLUMN` | ⚠️ Caution | Must have DEFAULT, must be nullable |
| `ALTER TABLE DROP COLUMN` | ❌ No | Requires data migration plan + user approval |
| `DROP TABLE` | ❌ No | Requires full dependency audit |
| `CREATE FUNCTION` | ✅ Yes | Must use SECURITY DEFINER + fixed search_path |
| `ALTER FUNCTION` | ⚠️ Caution | Must not change signature |
| `DROP FUNCTION` | ❌ No | May break edge functions silently |
| `ALTER PUBLICATION` | ✅ Yes | For enabling realtime on new tables |

---

## 6. Edge Function Standards

Every edge function MUST:
1. Import CORS from `_shared/cors.ts`
2. Handle OPTIONS preflight
3. Validate authentication (unless public endpoint)
4. Return RFC 7807 errors (no stack traces)
5. Log to `audit_logs` for state-changing operations
6. Support `Idempotency-Key` for financial operations
7. Use `SUPABASE_SERVICE_ROLE_KEY` for admin operations
8. Never expose internal error details to clients

---

## 7. Incident Response

If a core component must be modified due to a security incident:

1. Document the vulnerability in `docs/audit/`
2. Create a targeted fix (minimum viable change)
3. Verify all dependent components still function
4. Update this policy document if new protections are needed
5. Log the change in `docs/changelog.md` and `docs/changelog.json`

---

## 8. Compliance Summary

| Metric | Target | Status |
|---|---|---|
| Core functions frozen | 19 PL/pgSQL functions | ✅ Enforced |
| Core edge functions frozen | 16 endpoints | ✅ Enforced |
| Shared utilities frozen | 3 files | ✅ Enforced |
| Zero breaking changes | 0 allowed | ✅ Policy active |
| RLS coverage | 100% of tables | ✅ Verified |
| RFC 7807 compliance | All error responses | ✅ Verified |
| Audit trail | All state changes | ✅ Verified |

---

*This policy is binding for all changes to the Kang Open Banking v1 platform. Violations risk production outages, data corruption, or security breaches.*
