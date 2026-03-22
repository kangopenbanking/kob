

# Plan: Close KOB Gap Analysis — OpenAPI Spec + Webhook Secret Rotation

## Summary of findings

| Gap | Code Status | Spec/Docs Status | Action Needed |
|-----|-------------|-------------------|---------------|
| A: Inbound provider webhooks | ✅ Fully implemented (3 edge functions + tests) | ❌ Not in OpenAPI spec | Add to openapi.json + openapi-sandbox.json |
| B: Merchant lifecycle | ✅ Full state machine + key rotation + webhooks | ⚠️ Missing webhook secret rotation endpoint | Add rotate-secret action to gateway-merchant-webhooks |
| C: Developer portal | ✅ Redoc + static + noscript fallbacks | ✅ Working | No changes needed |

## Implementation

### 1. Add inbound provider webhook paths to OpenAPI specs

Add three new paths to both `public/openapi.json` and `public/openapi-sandbox.json` under a new tag "Provider Webhooks (Inbound)":

- `POST /webhooks/stripe` — Stripe inbound webhook receiver
- `POST /webhooks/flutterwave` — Flutterwave inbound webhook receiver  
- `POST /webhooks/paypal` — PayPal inbound webhook receiver

Each path will document:
- No auth (secured by provider signature verification)
- Request body schema matching provider payload formats
- Response: 200 with `{status: "processed"}` or `{status: "already_processed"}`
- 401 for invalid signatures, 429 for rate limits
- Description covering signature verification, deduplication, and event types handled

Also add the tag description to the tags array in both specs.

### 2. Add webhook secret rotation to gateway-merchant-webhooks

Add a new action branch in the existing `gateway-merchant-webhooks/index.ts` edge function:

When `method === 'POST'` and `action === 'rotate-secret'` and `webhookId`:
- Look up the webhook by ID + merchant ownership
- Generate a new secret (`crypto.randomUUID() + '-' + crypto.randomUUID()`)
- Update the webhook's `secret` column
- Return the new secret with the same "store securely, shown once" warning
- Add audit logging

### 3. Add webhook secret rotation to OpenAPI specs

Document the new operation:
- `POST /v1/gateway/merchants/webhooks/{webhookId}/rotate-secret?merchant_id={id}`
- Response: 200 with new secret + warning

### Files to modify
1. `public/openapi.json` — add 3 inbound webhook paths + 1 rotate-secret path + tag
2. `public/openapi-sandbox.json` — same additions
3. `supabase/functions/gateway-merchant-webhooks/index.ts` — add rotate-secret action

No existing routes, tables, or behaviors are changed.

