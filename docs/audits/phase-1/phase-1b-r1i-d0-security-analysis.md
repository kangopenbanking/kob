# Phase 1B — R1I-d.0 — Pagination Security Analysis

**Focus:** Cursor safety, tenant/ownership isolation of paginated reads, count-query scope parity, provider-token leakage.

## 1. Cursor security classification

| Class | Definition |
|-------|-----------|
| SAFE | Opaque token, tenant + filter + ordering bound; validated; rejects malformed with 400. |
| INFORMATION_LEAK | Cursor exposes internal IDs / timestamps in plaintext. |
| CROSS_SCOPE_REUSE_RISK | Cursor from op A / user A works on op B / user B. |
| TAMPERABLE | Cursor decodable and re-encodable without integrity check. |
| UNVALIDATED | Handler accepts arbitrary strings, throws 500 on bad input. |
| NOT_IMPLEMENTED | No cursor is issued. |

## 2. Findings

| Operation set | Class | Evidence / concern |
|---------------|-------|--------------------|
| AISP + consents reference handlers (`aispAccounts`, `aispTransactions`, `aispBalances`, `consentsList`) | **TAMPERABLE** (present implementation) | Cursor is `base64(JSON({created_at, id}))`. No HMAC. Filter/tenant not bound into token — a caller can decode and forge continuation for a different `account_id` if the handler does not re-check scope (which it currently *does* via RLS + request-scoped `accountId`, so the practical impact is contained by RLS). Recommendation: sign cursor with per-environment key. |
| All OFFSET_LIMIT gateway/admin/webhook lists | **NOT_IMPLEMENTED (opaque cursor)** — offset is passed in plaintext | No leak (offset is an integer), but no protection against high-offset DoS either. |
| `agentTransactionList`, `cemacCorridorsList`, `merchantsQrDirectoryList`, `listWebhookDlq`, `agentList` | **NOT_IMPLEMENTED** | Array responses, no cursor at all. |
| Provider-token pass-through (some `gatewayListPayouts` branches) | **UNVALIDATED / potential CROSS_SCOPE_REUSE_RISK** | If Nium cursor is emitted verbatim, an attacker can supply a cursor obtained under another integration. Deferred to provider-adapter slice; confirm binding to `merchant_id`. |

## 3. Tenant / ownership isolation

Reviewed the reference handlers and the pattern in `supabase/functions/_shared/scope.ts` (where present). Each collection handler is expected to enforce scope in **three** places:

1. **Data query WHERE clause** — the `merchant_id` / `institution_id` / `user_id` / `consent_id` predicate.
2. **Count query WHERE clause** — the exact same predicate. **Not confirmed** on the OFFSET_LIMIT bulk; a d.1 code pass must verify.
3. **Cursor decode** — must reject a cursor whose embedded tenant/filter does not match the request. **Not enforced today** on the AISP reference (tenant is inferred from URL/JWT; scope escape blocked only by DB RLS).

### Per-domain summary

| Domain | Data scope | Count scope | Cursor scope | Verdict |
|--------|-----------|-------------|--------------|---------|
| AISP | JWT + accountId + consent | Same | Not bound into token | ACCEPTABLE (RLS backstop) |
| Consent | JWT + tpp | Same | Not bound | ACCEPTABLE (RLS backstop) |
| Payment Gateway | `merchant_id` from API key | **Verify parity in d.1** | Offset only | ACCEPTABLE (offset), needs verification |
| Admin | admin role check | Same | Offset only | ACCEPTABLE |
| Webhooks | `merchant_id` / `webhook_id` scope | **Verify parity** | Offset only | ACCEPTABLE, verify |
| Interbank | `participant_id` from client cert | **Verify parity** | Offset only | Requires verification |
| Ledger (`journalList`, `ledgerAccounts`) | `institution_id` | Same | Offset only | ACCEPTABLE |

## 4. Cross-scope reuse test surface

Because current cursors are **not signed** and **not bound**, the only barrier is that the handler resolves scope from the request context and then relies on Supabase RLS to filter. Two failure modes to test in d.1:

1. A cursor decoded from op A used against op B on the same table → does RLS still filter? (Likely yes, but not asserted by any test.)
2. A cursor for `accountId=X` submitted with a request path for `accountId=Y` → does the handler cross-check the token's embedded `account_id` against the URL parameter? (No test today.)

## 5. Recommended security enhancements (not authored)

- Adopt HMAC-signed cursor tokens (`base64url(hmac-sha256(secret, payload) || payload)`).
- Bind `{env, tenant_id, resource_id, filters_hash, order_key, cursor_position}` into every cursor payload.
- Reject cursors whose bound scope does not match request scope with `400 PAGINATION_CURSOR_SCOPE_MISMATCH`.
- Add `400 PAGINATION_CURSOR_INVALID` for malformed tokens (currently 500 on some paths).
- Rotate cursor-signing key with an overlap window (double-verify on rollover) to allow in-flight pagination to complete.

## 6. Read-only status

No handler and no security policy were edited. Recommendations are proposals only.
