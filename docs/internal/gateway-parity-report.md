# Gateway Feature Parity Report (Phase 0, read-only)

**Spec:** v4.26.7 · **Surface checked:** payment gateway operations expected at Stripe / Flutterwave grade.

## Result table

| Capability | Status | Evidence / note |
|---|---|---|
| Charges — create / get / list / verify / cancel | ✅ | `/v1/gateway/charges` (POST/GET/list), `/verify`, `/cancel` |
| Charges — preauth / capture / void | ✅ | `authorize` / `capture` / `void` operationIds present |
| Refunds — create / get / list | ✅ | `/v1/gateway/refunds` full CRUD |
| Payouts — create / get / list | ✅ | `/v1/gateway/payouts` |
| Payout batches | ✅ | `payout-batches` paths present |
| Beneficiaries | ✅ | List/create/get; delete present |
| Settlements + reports | ✅ | `/v1/gateway/settlements` + `settlements/exports` (CSV) |
| Disputes + evidence | ✅ | `disputes` list + `disputes/{id}/evidence` |
| Customers | ✅ | `/v1/gateway/customers` CRUD |
| **Tokens / payment-methods** | ⚠️ **GAP** | Detected only `…/customers/{id}/tokens` revoke — no top-level `/v1/gateway/tokens` list/create surface like Stripe `payment_methods`. **Recommend** adding `GET /v1/gateway/customers/{id}/tokens` + `POST` (additive). |
| Payment links | ✅ | `/v1/gateway/payment-links` |
| Subscriptions / plans | ✅ | `subscriptions` and `payment-plans` |
| Funding intents / fund account | ✅ | `funding` + `account/fund` paths exist |
| Withdraw to bank / PayPal | ✅ | `withdrawals` + `paypal` paths exist |
| **Merchant webhooks (per-merchant endpoints)** | ⚠️ **NAMING GAP** | Endpoints exist as `/v1/gateway/webhook-endpoints/*` (not under `/merchants/{id}/webhooks`). Functionally complete; just doesn't match the auditor's strict regex. **No fix required** — naming is consistent with rest of `/v1/gateway/*` surface. |
| Webhook secret rotation | ✅ | `webhook-endpoints/{id}/rotate-secret` present |
| Reconciliation queues | ✅ | `reconciliation` paths present |
| Fee reports | ✅ | `fees/report` + `fees/export` |
| Inbound provider webhooks | ✅ | `POST /webhooks/stripe`, `/webhooks/flutterwave`, `/webhooks/paypal` (see provider-webhooks-report.md) |

## Verdict

**32/34 capabilities present** with one true gap:

### Gap GP-1 — Customer payment tokens listing/creation
- **Currently:** Only `DELETE /v1/gateway/customers/{customerId}/tokens/{tokenId}` exists (revoke).
- **Stripe parity:** `payment_methods.list`, `payment_methods.attach`, `payment_methods.detach`.
- **Recommendation:** Phase 1 — additively add:
  - `GET /v1/gateway/customers/{customerId}/tokens` (list)
  - `POST /v1/gateway/customers/{customerId}/tokens` (create/attach)
- **Bump:** minor (4.27.0) once the 2 new operations are added.

No other parity gaps. The `merchant_webhooks` "miss" is a regex naming difference, not a functional gap.
