# kangopenbanking — Python SDK

Official Python SDK for the **Kang Open Banking (KOB) API v4.51.5**.

## Installation

```bash
pip install kangopenbanking
```

## Quick Start

```python
from kangopenbanking import KangOpenBanking

# Sandbox
kob = KangOpenBanking(
    client_id="your_client_id",
    api_key="sbx_your_sandbox_key",
    environment="sandbox",
)

# Production
kob = KangOpenBanking(
    client_id="your_client_id",
    client_secret="your_client_secret",
    environment="production",
)
```

## AISP — Account Information

```python
# List accounts
accounts = kob.accounts.list()
for acc in accounts:
    print(f"{acc.account_holder_name} — {acc.currency}")

# Get balances
balances = kob.balances.get("account_uuid")

# Get transactions
txns = kob.transactions.list("account_uuid", from_date="2026-01-01")

# Get beneficiaries
beneficiaries = kob.beneficiaries.list("account_uuid")
```

## Gateway — Payments

```python
# Create a Mobile Money charge
charge = kob.charges.create(
    merchant_id="mch_uuid",
    amount=5000,
    currency="XAF",
    channel="mobile_money",
    customer_phone="237677123456",
    tx_ref="order_001",
)
print(f"Charge {charge.id}: {charge.status}")

# Verify charge
verified = kob.charges.verify(charge.id)

# Estimate fees
fees = kob.gateway.estimate_fee(amount=5000, channel="mobile_money")
print(f"Fee: {fees.fee_amount} XAF")

# Create refund
refund = kob.refunds.create(charge_id=charge.id, amount=2500)

# Create payout
payout = kob.payouts.create(
    merchant_id="mch_uuid",
    amount=10000,
    currency="XAF",
    channel="mobile_money",
    beneficiary_name="Jean Nkomo",
    beneficiary_account="237677654321",
)
```

## Webhook Verification

```python
is_valid = KangOpenBanking.verify_webhook_signature(
    payload=raw_body,
    signature=request.headers["X-KOB-Signature"],
    secret="your_webhook_secret",
)
```

## Error Handling

```python
from kangopenbanking import KOBError

try:
    charge = kob.charges.create(...)
except KOBError as e:
    print(f"[{e.error_code}] {e} (ID: {e.error_id})")
    print(f"HTTP {e.status_code}")
```

## Context Manager

```python
with KangOpenBanking(client_id="id", api_key="sbx_key") as kob:
    accounts = kob.accounts.list()
```

## Links

- [API Documentation](https://kangopenbanking.com/developer)
- [Getting Started](https://kangopenbanking.com/developer/getting-started)
- [OpenAPI Spec](https://kangopenbanking.com/openapi.json)
- [Sandbox Spec](https://kangopenbanking.com/openapi-sandbox.json)
- [API Status](https://kangopenbanking.com/developer/status)
- Email: developers@kangopenbanking.com

## License

MIT

## PISP Payment Submission (v4.29.3)

As of OpenAPI v4.29.3, `POST /v1/pisp/payment-submission` requires the full payment instruction.

```python
import uuid

kob.pisp.submit_payment(
    payment_id="pmt_01HX...",
    consent_id="cns_01HX...",
    amount="50000",
    currency="XAF",
    debtor_account="10005-00001-09876543210-45",
    creditor_account="10005-00001-12345678901-23",
    idempotency_key=str(uuid.uuid4()),
)
```

## Changelog

- **1.6.1** — Aligned to OpenAPI v4.29.3 PISP submission schema.
- **1.6.0** — OpenAPI v4.28.x baseline.
