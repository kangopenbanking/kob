

## Audit: KOB API Sandbox Authentication — Critical Gap

### Root Cause (Verified)

The sandbox returns **401 Unauthorized** for `sk_test_*` / `pk_test_*` / `merch_*` credentials because **no edge function on the gateway actually validates these keys.** They are issued and stored, but never accepted as authentication anywhere in the request path.

**The auth contract is broken end-to-end:**

| Layer | What it does | Gap |
|---|---|---|
| Key issuance (`sandbox-create-api-key`, `sandbox/issue`) | Generates `sk_test_<hex>`, hashes to `sandbox_api_keys.key_hash` | ✅ works |
| Documentation & SDKs (40+ pages) | Tells integrators to send `Authorization: Bearer sk_test_...` | ✅ documented |
| `gateway` router (`/gateway/charges`, etc.) | Forwards the `Authorization` header verbatim to leaf function | ✅ forwards |
| `gateway-create-charge` (and every other leaf) | Calls `supabase.auth.getUser(authHeader)` — expects a **Supabase user JWT**, not a `sk_test_` key | ❌ **REJECTS the documented credential** |
| `gateway-merchant-keys` | Issues `sk_live_/sk_test_` and stores `secret_key_hash` | ❌ **No function ever reads this table to authenticate a request** |
| Sandbox key validator (`sandbox/validate-api-key`) | Only accepts `sbx_*` legacy prefix, not `sk_test_*` | ❌ partial |
| `X-Merchant-ID` header | Not read by any function (search: 0 matches) | ❌ does not exist |

**Why integrators see 401 under "any auth scheme":** `supabase.auth.getUser('sk_test_xxx')` returns `null` because it's not a JWT. The leaf returns 401. The same happens for `Bearer kob_test_*`, `X-API-Key`, etc. — none are recognized.

This violates **Standing Order P5 (Working Code Rule)** and **P3 (Free Sandbox Rule)** — every code example in the docs is broken.

---

### Fix Plan

**1. Build a shared API-key authenticator** (`supabase/functions/_shared/auth-api-key.ts`)

Single source of truth used by all gateway leaves. Resolution order:
1. If `Authorization: Bearer <token>` and token starts with `sk_test_` / `sk_live_` → SHA-256 hash, lookup in `gateway_merchant_keys` (live/test) **and** `sandbox_api_keys` → return resolved `{ user_id, merchant_id, environment, key_id }`.
2. Else if token starts with `sbx_` → lookup in `sandbox_api_keys.api_key` (legacy) → return same shape.
3. Else if token is a JWT → fall back to `supabase.auth.getUser()` (preserves dashboard/PAT flow — non-breaking).
4. Else → standardized 401 RFC 7807 envelope.

Also accept `X-API-Key` header as alias (matches docs that show `X-API-Key + X-Merchant-ID`).

**2. Wire the authenticator into the gateway leaves** (additive, Standing Order #4)

Replace the inline `supabase.auth.getUser()` block in:
- `gateway-create-charge`
- `gateway-create-payout`, `gateway-create-refund`, `gateway-create-payment-link`, `gateway-create-funding-intent`, `gateway-create-subscription`
- `gateway-query`, `gateway-charges-router`, `gateway-merchant-statement`, `gateway-get-merchant-balance`
- `gateway-fee-estimate`, `gateway-fund-account`, `gateway-confirm-funding`
- `gateway-webhook-endpoints`, `gateway-escrow-wallets`, `gateway-bulk-operations`, `gateway-reconciliation`

When called with `sk_test_`, the resolver returns the merchant's `user_id` so existing `eq('user_id', user.id)` ownership checks keep working unchanged.

**3. Auto-resolve `merchant_id` from key**

If body omits `merchant_id` and the key is bound to a single merchant (live keys always are), inject it server-side. This makes the `X-Merchant-ID` header optional and matches Stripe-style ergonomics.

**4. Last-used tracking + rate limits**

On every successful key auth, async-update `last_used_at` and `last_used_ip`. Enforce per-key `rate_limit_per_minute` from `sandbox_api_keys` (already stored, currently unused).

**5. Sandbox key audit fix**

Update `sandbox/validate-api-key` to accept both `sk_test_` and legacy `sbx_` formats so the contract test (`api-contract-test`) keeps passing.

**6. Documentation reconciliation**

- `docs/developer-portal/auth/authentication-overview.md`: clarify that `Authorization: Bearer sk_test_...` IS the canonical scheme; `X-API-Key` is an accepted alias; `X-Merchant-ID` is **optional** (resolved from key).
- Add a 5-line "Why was my key rejected?" troubleshooting block.

**7. Changelog** (`src/pages/developer/Changelog.tsx`) — bump **v4.16.1 → v4.16.2** per Standing Order #6:
> **Fixed**: Sandbox & live API keys (`sk_test_*`, `sk_live_*`) are now accepted as bearer tokens across all `/v1/gateway/*` endpoints. Previously, only Supabase JWTs were accepted, causing 401 errors for documented integration flows. Resolves [P5 Working Code Rule] violation.

**8. E2E verification**

Run live curl probes through `supabase--curl_edge_functions`:
- `POST /gateway/charges` with `Authorization: Bearer sk_test_<real>` → expect 200/400 (not 401)
- `POST /gateway/charges` with `Authorization: Bearer sk_test_invalid` → expect 401 RFC 7807
- `POST /gateway/charges` with `X-API-Key: sk_test_<real>` (no merchant_id in body) → expect 200/400
- `POST /gateway/charges` with valid Supabase JWT → expect 200 (regression check)
- Re-run `api-contract-test` suite — must stay green.

---

### Files Touched

| File | Action |
|---|---|
| `supabase/functions/_shared/auth-api-key.ts` | **NEW** — shared resolver |
| `supabase/functions/gateway-create-charge/index.ts` | Swap auth block (additive guard) |
| 15 other gateway leaves listed above | Same swap |
| `supabase/functions/sandbox/index.ts` | `validate-api-key` accepts `sk_test_` |
| `docs/developer-portal/auth/authentication-overview.md` | Clarify scheme + troubleshooting |
| `docs/developer-portal/auth/api-keys.md` | Add "How keys are validated" section |
| `src/pages/developer/Changelog.tsx` | v4.16.2 entry |

**No table changes. No removals. No breaking changes.** All existing JWT-based callers (merchant dashboard, admin portal) continue to work unchanged because the resolver falls back to `auth.getUser()` for non-`sk_*` tokens.

### Standing Order Compliance

| Order | Verdict |
|---|---|
| #1 Lock — no renames | ✅ |
| #2 Ratchet — only adds accepted credentials | ✅ |
| #3 Audit Trail — cites RFC 7807, P5 | ✅ |
| #4 Surgeon — additive auth resolver | ✅ |
| #6 Version Gate — patch bump 4.16.1 → 4.16.2 | ✅ |
| P5 Working Code Rule — restored | ✅ |

