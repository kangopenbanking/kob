# API Keys

## Overview

Merchant API keys authenticate requests to the Payment Gateway. Each key is environment-specific.

## Key Types

| Type | Secret Prefix | Publishable Prefix | Purpose |
|---|---|---|---|
| Sandbox | `sk_test_` | `pk_test_` | Test without real money |
| Production | `sk_live_` | `pk_live_` | Process real transactions |

Each key set also includes a `merchant_id` (e.g. `acct_test_…`) and a `webhook_secret` (`whsec_test_…`) for signature verification.

## Creating Keys

1. Navigate to **Merchant Portal → API Keys**
2. Select environment (Sandbox or Production)
3. Click **Generate New Key**
4. Copy both **Public Key** and **Secret Key**

> ⚠️ The secret key is shown **once**. Store it securely immediately.

## Key Rotation

Rotate keys without downtime:

1. Generate a new key pair
2. Update your integration to use the new key
3. Old key remains valid for **24 hours** (grace period)
4. After 24 hours, the old key is automatically deactivated

## Revoking Keys

Immediately invalidate a compromised key:

1. Go to **Merchant Portal → API Keys**
2. Click **Revoke** on the compromised key
3. The key is instantly invalidated — no grace period

## Security Best Practices

- Never expose keys in client-side code or version control
- Use environment variables to store keys
- Rotate keys regularly (recommended: every 90 days)
- Use separate keys for sandbox and production
- Monitor key usage in the Merchant Portal

## Rate Limits

API keys are rate-limited per endpoint. See [Rate Limits](../reference/rate-limits.md) for details.

## How keys are validated

Every gateway request runs through a single shared resolver (`_shared/auth-api-key.ts`):

1. **Extract token** from `Authorization: Bearer …` (preferred) or `X-API-Key` (alias).
2. **Identify scheme by prefix:**
   - `sk_test_*` / `sk_live_*` → SHA-256 hash → looked up in `gateway_merchant_keys` (preferred) then `sandbox_api_keys`.
   - `sbx_*` → legacy sandbox table lookup.
   - 3-segment JWT → falls back to `auth.getUser()` (dashboard / PAT flow).
3. **Bind to merchant** — when the key resolves to exactly one merchant, `merchant_id` is injected into the request automatically. `X-Merchant-ID` is only required when a key has access to multiple merchants.
4. **Last-used tracking** — `last_used_at` is updated asynchronously on every successful authentication (best-effort, never blocks the request).

On any failure the gateway returns a standardized `application/problem+json` envelope (RFC 7807) with `status: 401` and a `detail` describing the rejection reason.
