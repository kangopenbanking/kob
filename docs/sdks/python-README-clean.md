# kangopenbanking

Official Python SDK for the **Kang Open Banking (KOB) API**.

- PyPI: https://pypi.org/project/kangopenbanking/
- API docs: https://kangopenbanking.com/developer
- OpenAPI spec: https://kangopenbanking.com/openapi.json
- Sandbox spec: https://kangopenbanking.com/openapi-sandbox.json
- Status: https://kangopenbanking.com/developer/status

## Requirements

- Python 3.8+
- `httpx` 0.24+

## Installation

```bash
pip install kangopenbanking
```

## Authentication

The Kang Open Banking platform uses **OAuth 2.0** for production-track (`ga`)
endpoints, matching what is documented at
https://kangopenbanking.com/developer/getting-started:

| Flow                                        | When to use                                  |
| ------------------------------------------- | -------------------------------------------- |
| `client_credentials`                        | Server-to-server (your backend ↔ KOB)        |
| `authorization_code` + **PKCE** (S256)      | End-user delegated access (AISP / PISP)      |
| Sandbox API key (`sbx_…`) via `X-API-Key`   | Quick sandbox testing only — never in prod   |

### Server-to-server (`client_credentials`)

When `client_secret` is provided, the SDK fetches, caches, and refreshes
the access token automatically on the first API call:

```python
import os
from kangopenbanking import KangOpenBanking

kob = KangOpenBanking(
    client_id=os.environ["KOB_CLIENT_ID"],
    client_secret=os.environ["KOB_CLIENT_SECRET"],
    environment="production",
)

# First API call triggers the token fetch automatically.
accounts = kob.accounts.list()
```

You can also fetch a token explicitly:

```python
token = kob.get_token(grant_type="client_credentials", scope="accounts payments")
```

### Authorization Code + PKCE (user-delegated)

The SDK does **not** generate PKCE for you. Generate the verifier/challenge
in your application and persist them alongside the user's session, then
exchange the callback `code` for a token and hand it to the SDK:

```python
import base64
import hashlib
import secrets

# 1. Generate PKCE in your app:
verifier = base64.urlsafe_b64encode(secrets.token_bytes(64)).rstrip(b"=").decode()
challenge = base64.urlsafe_b64encode(
    hashlib.sha256(verifier.encode()).digest()
).rstrip(b"=").decode()

# 2. Redirect the user to:
#    https://kangopenbanking.com/oauth/authorize
#      ?client_id=...&redirect_uri=...&response_type=code
#      &scope=openid+accounts+payments&state=...&code_challenge=<challenge>
#      &code_challenge_method=S256

# 3. On callback, exchange the code for an access token.
token = kob.get_token(
    grant_type="authorization_code",
    code=callback_code,
    redirect_uri="https://yourapp.com/callback",
    code_verifier=verifier,
)

kob.set_access_token(token["access_token"], token.get("expires_in"))
```

### Sandbox API key

For quick sandbox testing, skip OAuth by passing an `sbx_…` key. The SDK
sends it as `X-API-Key`:

```python
kob = KangOpenBanking(
    client_id="your_client_id",
    api_key="sbx_your_sandbox_key",
    environment="sandbox",
)
```

## Quick start

```python
import os
from kangopenbanking import KangOpenBanking

kob = KangOpenBanking(
    client_id=os.environ["KOB_CLIENT_ID"],
    client_secret=os.environ["KOB_CLIENT_SECRET"],
    environment="sandbox",
)

# AISP — list a user's accounts
accounts = kob.accounts.list()

# Gateway — create a Mobile Money charge
charge = kob.charges.create(
    merchant_id="mch_uuid",
    amount=5000,
    currency="XAF",
    channel="mobile_money",
    customer_phone="237677123456",
    tx_ref="order_001",
)

# Verify the charge status
verified = kob.charges.verify(charge.id)
```

## Available resources

These match the public attributes exposed by `KangOpenBanking` (see
`kangopenbanking/client.py`):

| Attribute               | Class                       |
| ----------------------- | --------------------------- |
| `kob.accounts`          | `_AccountsResource`         |
| `kob.balances`          | `_BalancesResource`         |
| `kob.transactions`      | `_TransactionsResource`     |
| `kob.beneficiaries`     | `_BeneficiariesResource`    |
| `kob.charges`           | `_ChargesResource`          |
| `kob.refunds`           | `_RefundsResource`          |
| `kob.payouts`           | `_PayoutsResource`          |
| `kob.gateway`           | `_GatewayResource`          |
| `kob.sandbox_tools`     | `_SandboxResource`          |
| `kob.global_accounts`   | `GlobalAccountsResource`    |

Additional helpers exported from the package top level: `MerchantOps` and
`qr` (see `kangopenbanking/__init__.py`).

## AISP — Account information

```python
accounts = kob.accounts.list()
balances = kob.balances.get("account_uuid")
txns = kob.transactions.list(
    "account_uuid",
    from_date="2026-01-01",
    to_date="2026-03-20",
    page=1,
    per_page=50,
)
beneficiaries = kob.beneficiaries.list("account_uuid")
```

## Gateway — Payments

```python
charge = kob.charges.create(
    merchant_id="mch_uuid",
    amount=5000,
    currency="XAF",
    channel="mobile_money",
    customer_phone="237677123456",
    tx_ref="order_001",
)

fees = kob.gateway.estimate_fee(amount=5000, channel="mobile_money", currency="XAF")

refund = kob.refunds.create(charge_id=charge.id, amount=2500, reason="Customer request")

payout = kob.payouts.create(
    merchant_id="mch_uuid",
    amount=10000,
    currency="XAF",
    channel="mobile_money",
    beneficiary_name="Jean Nkomo",
    beneficiary_account="237677654321",
)
```

## Sandbox tools

```python
account = kob.sandbox_tools.create_account(
    account_holder_name="Test User", currency="XAF"
)
kob.sandbox_tools.generate_data(data_type="transactions", count=50)
```

## Webhook verification

```python
is_valid = KangOpenBanking.verify_webhook_signature(
    payload=raw_body,
    signature=request.headers["X-KOB-Signature"],
    secret=os.environ["KOB_WEBHOOK_SECRET"],
)
```

## Error handling

```python
from kangopenbanking import KOBError

try:
    charge = kob.charges.create(...)
except KOBError as e:
    print(f"[{e.error_code}] {e} (id={e.error_id}, http={e.status_code})")
```

## Context manager

```python
with KangOpenBanking(client_id="id", api_key="sbx_key") as kob:
    accounts = kob.accounts.list()
```

## Rate limits

| Endpoint group     | Limit                       |
| ------------------ | --------------------------- |
| Token endpoint     | 100 / hour per client       |
| AISP endpoints     | 1,000 / hour per consent    |
| PISP endpoints     | 500 / hour per client       |
| Gateway endpoints  | 1,000 / hour per merchant   |

HTTP 429 responses include a `Retry-After` header.

## Other language SDKs

Each SDK is versioned and released independently. Check each package page
for its current status and version before depending on it:

- Python (this package) — https://pypi.org/project/kangopenbanking/
- Node.js — https://www.npmjs.com/package/@kangopenbanking/sdk
- PHP — https://packagist.org/packages/kangopenbanking/sdk

## Support

- Email: developers@kangopenbanking.com
- Docs: https://kangopenbanking.com/developer

## License

MIT
