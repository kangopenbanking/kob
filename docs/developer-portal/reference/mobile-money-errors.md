# Mobile Money Error Codes

KOB normalises every provider-specific error into a single taxonomy. SDKs and webhook consumers should branch on `normalized_code`; the raw provider code is retained in `raw_code` for audit and support.

Reference: GSMA Mobile Money API v1.2 §6 — Error handling.

## Unified Error Codes

| `normalized_code` | Meaning | Retryable |
|---|---|---|
| `insufficient_funds` | Subscriber balance is too low. | No |
| `invalid_msisdn` | MSISDN failed format or country validation. | No |
| `subscriber_not_found` | No active wallet for the supplied MSISDN. | No |
| `subscriber_pin_blocked` | Subscriber PIN is locked by the provider. | No |
| `subscriber_kyc_incomplete` | Provider rejected for missing KYC tier. | No |
| `subscriber_limit_exceeded` | Daily / monthly / per-transaction limit hit. | No |
| `duplicate_transaction` | Provider rejected a replayed reference. | No |
| `transaction_expired` | Subscriber did not approve in time. | No |
| `transaction_declined` | Subscriber explicitly declined. | No |
| `provider_timeout` | No upstream response inside SLA. | **Yes** |
| `provider_unavailable` | Provider returned 503 / circuit open. | **Yes** |
| `currency_not_supported` | Currency not enabled on the corridor. | No |
| `amount_below_minimum` | Below provider minimum. | No |
| `amount_above_maximum` | Above provider maximum. | No |
| `internal_error` | Anything else; logged for support triage. | **Yes** |

## Provider Mapping (excerpt)

| Provider | Raw code | Normalized code |
|---|---|---|
| MTN MoMo | `NOT_ENOUGH_FUNDS` | `insufficient_funds` |
| MTN MoMo | `PAYER_NOT_FOUND` | `subscriber_not_found` |
| MTN MoMo | `EXPIRED` | `transaction_expired` |
| Orange Money | `60019` | `insufficient_funds` |
| Orange Money | `60003` | `subscriber_kyc_incomplete` |
| Wave | `INSUFFICIENT_FUNDS` | `insufficient_funds` |
| Wave | `TIMED_OUT` | `provider_timeout` |
| M-Pesa | `1` | `insufficient_funds` |
| M-Pesa | `2` | `subscriber_pin_blocked` |
| Airtel Money | `ESB000008` | `insufficient_funds` |
| Airtel Money | `ESB000011` | `duplicate_transaction` |

The full table lives in `supabase/functions/_shared/momo-errors.ts`.

## Response shape

Errors are returned as RFC 7807 `application/problem+json` with a `provider_error` extension:

```json
{
  "type": "https://docs.kangopenbanking.com/errors/mobile-money-declined",
  "title": "Mobile money transaction declined",
  "status": 422,
  "provider_error": {
    "provider": "mtn",
    "raw_code": "NOT_ENOUGH_FUNDS",
    "raw_message": "Subscriber balance too low",
    "normalized_code": "insufficient_funds",
    "retryable": false
  }
}
```

## Snippets

```ts
// Node.js
if (err.provider_error?.normalized_code === "insufficient_funds") {
  notifyUserToTopUp();
} else if (err.provider_error?.retryable) {
  await sleep(2000); retry();
}
```

```py
# Python
if err["provider_error"]["normalized_code"] == "insufficient_funds":
    notify_top_up()
elif err["provider_error"]["retryable"]:
    time.sleep(2); retry()
```

```bash
# cURL
curl -X POST https://api.kangopenbanking.com/v1/mobile-money/charge \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"amount":1000,"phone_number":"+237670000000","provider":"mtn"}'
```
