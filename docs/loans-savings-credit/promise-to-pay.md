# Promise to Pay (v1)

**Endpoint base:** `https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1`

The Promise to Pay (P2P) module lets a borrower formally commit to repay a loan
by a chosen date and method. Outcomes feed the credit-score engine:

| Outcome | Credit score impact |
|---|---|
| `kept` (full amount on or before due date) | **+3** (capped +15 / 90d) |
| `partially_kept` | **+1** (capped +5 / 90d) |
| `broken` (overdue, swept by `ptp-settle?mode=sweep`) | **-25** |
| `rescheduled` (first time, before due) | 0 |
| `rescheduled` (repeat within 30 days) | **-5** |

## Endpoints

All requests must include a Supabase JWT for the customer in the
`Authorization: Bearer <jwt>` header.

### Create a promise

```bash
curl -X POST $BASE/ptp-ops \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "loan_account_id": "…",
    "promised_amount": 25.53,
    "promised_date": "2026-07-04",
    "payment_method": "pay_by_bank",
    "currency": "GBP",
    "idempotency_key": "f4f0c1e8-..."
  }'
```

### List my promises

```bash
curl $BASE/ptp-ops?action=list -H "Authorization: Bearer $JWT"
```

### Reschedule

```bash
curl -X POST $BASE/ptp-ops \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{ "action": "reschedule", "promise_id": "…", "promised_date": "2026-07-11" }'
```

### Cancel (scheduled only)

```bash
curl -X POST $BASE/ptp-ops \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{ "action": "cancel", "promise_id": "…" }'
```

### Match a repayment (server-to-server)

`pay-by-bank` and `loan-ops` call this automatically after a successful
repayment. External integrators may also call it with a service-role token.

```bash
curl -X POST $BASE/ptp-settle \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "Content-Type: application/json" \
  -d '{ "mode": "match", "loan_account_id": "…", "amount": 25.53 }'
```

## Justification (Standing Order 3)

FCA CONC 7.3 / CBP Vulnerable Customer Treatment — institutions must support
arrangements where customers commit to a future payment and must report kept
vs broken arrangements to the credit file. The module implements both sides
additively without modifying existing loan or credit schemas.
