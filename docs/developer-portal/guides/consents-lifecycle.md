# Consent Lifecycle

Reference: Berlin Group NextGenPSD2 v1.3.6 §5.

`/v1/consents` is a rail-agnostic façade. Use it instead of calling `aisp-create-consent` / `pisp-create-consent` directly.

## State machine

```text
AwaitingAuthorisation
     │  PSU approves
     ▼
 Authorised ──► Consumed (PISP only, after payment submission)
     │
     │  PSU revokes / TPP revokes
     ▼
  Revoked
     │
     │  expiration_date reached
     ▼
  Expired
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/consents` | Create AISP / PISP / CBPII consent |
| `GET` | `/v1/consents` | List consents (paginated, filterable by `type`, `status`) |
| `GET` | `/v1/consents/{id}` | Read one |
| `DELETE` | `/v1/consents/{id}` | Revoke |
| `POST` | `/v1/consents/{id}/extend` | Push expiration further out |

## Create

```bash
curl -X POST https://api.kangopenbanking.com/v1/consents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "type": "AISP",
    "permissions": ["ReadAccountsBasic","ReadBalances","ReadTransactionsDetail"],
    "expiration_date": "2026-12-31T23:59:59Z"
  }'
```

```ts
// Node.js
const r = await kob.consents.create({
  type: "AISP",
  permissions: ["ReadAccountsBasic", "ReadBalances"],
  expiration_date: "2026-12-31T23:59:59Z",
});
```

```py
# Python
r = kob.consents.create(
  type="AISP",
  permissions=["ReadAccountsBasic", "ReadBalances"],
  expiration_date="2026-12-31T23:59:59Z",
)
```

## Revoke

```bash
curl -X DELETE https://api.kangopenbanking.com/v1/consents/$CONSENT_ID \
  -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: $(uuidgen)"
```

Returns `204 No Content`.

## Notes

- `permissions` are validated against the rail. PISP consents accept `InitiatePayment` only.
- The legacy rail-specific endpoints (`/v1/aisp/consents`, `/v1/pisp/consents`) remain available indefinitely (Standing Order #1 — no removals).
