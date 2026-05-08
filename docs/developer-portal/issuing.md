# Virtual Card Issuing — Kora Middleware (v4.32.0)

**Released:** 2026-05-08
**Status:** General Availability (sandbox + live)
**Audience:** Banks, Financial Institutions, Developers
**Standards cited:** PCI-DSS v4.0 (scope reduction via tokenization), ISO 8583 (transaction message structure), FAPI-1.0-Adv §5.2 (resource access), RFC 7807 (problem details).

## Overview

The Kang Open Banking platform now supports issuing **USD virtual cards** to your end customers via the **Kora (Korapay)** issuing rail. Banks and licensed developers can:

- Register cardholders (with KYC tier 1–3)
- Issue Visa virtual cards in USD
- Fund / withdraw card balance from a tenant wallet
- Freeze / unfreeze / terminate cards
- Receive authoritative event webhooks (`virtualcard.charge`, `virtualcard.refund`, `virtualcard.decline`, `virtualcard.termination`)
- Reveal full PAN through a step-up MFA-gated short-lived endpoint

> Cardholder issuance is restricted to `bank` and `developer` tenants — consumer self-service issuance is no longer supported.

## Lifecycle

```text
  cardholder.create  →  card.issue  →  card.fund  ⇄  charges (webhook)
                                          │
                                          ├─ freeze ⇄ unfreeze
                                          └─ terminate (final)
```

## Endpoints (`/v1/issuing/`)

| Method | Path                                       | Purpose                            |
|--------|--------------------------------------------|------------------------------------|
| POST   | `/v1/issuing/cardholders`                  | Register a customer for issuing    |
| POST   | `/v1/issuing/cards`                        | Issue a new virtual card           |
| GET    | `/v1/issuing/cards`                        | List tenant cards                  |
| GET    | `/v1/issuing/cards/{id}`                   | Retrieve a card (masked)           |
| POST   | `/v1/issuing/cards/{id}/fund`              | Fund card from tenant wallet       |
| POST   | `/v1/issuing/cards/{id}/withdraw`          | Withdraw card balance              |
| POST   | `/v1/issuing/cards/{id}/freeze`            | Freeze a card                      |
| POST   | `/v1/issuing/cards/{id}/unfreeze`          | Unfreeze a card                    |
| POST   | `/v1/issuing/cards/{id}/terminate`         | Permanently terminate a card       |
| GET    | `/v1/issuing/cards/{id}/transactions`      | List card transactions             |
| POST   | `/v1/issuing/cards/{id}/reveal`            | Reveal full PAN (step-up MFA)      |

All write operations accept an `idempotency_key` (UUID v4). Duplicate keys return the original response.

## Quickstart (cURL)

```bash
# 1. Create a cardholder
curl -X POST https://api.kangopenbanking.com/v1/issuing/cardholders \
  -H "Authorization: Bearer $KOB_API_KEY" \
  -H "X-Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_external_id": "cust_001",
    "first_name": "Amina",
    "last_name": "Bello",
    "email": "amina@example.com",
    "phone": "+237670000000"
  }'

# 2. Issue a card
curl -X POST https://api.kangopenbanking.com/v1/issuing/cards \
  -H "Authorization: Bearer $KOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "cardholder_id": "<cardholder_uuid>",
    "program_id": "<program_uuid>",
    "card_name": "Online purchases",
    "initial_funding": 25
  }'
```

## Quickstart (Node.js)

```js
import { KangOpenBanking } from "@kangopenbanking/sdk-node";

const kob = new KangOpenBanking({ apiKey: process.env.KOB_API_KEY });

const ch = await kob.issuing.cardholders.create({
  customer_external_id: "cust_001",
  first_name: "Amina",
  last_name: "Bello",
  email: "amina@example.com",
});

const card = await kob.issuing.cards.issue({
  cardholder_id: ch.id,
  program_id: process.env.KOB_PROGRAM_ID,
  initial_funding: 25,
});
```

## Quickstart (Python)

```python
from kangopenbanking import Client

kob = Client(api_key=os.environ["KOB_API_KEY"])

ch = kob.issuing.cardholders.create(
    customer_external_id="cust_001",
    first_name="Amina", last_name="Bello",
    email="amina@example.com",
)

card = kob.issuing.cards.issue(
    cardholder_id=ch["id"],
    program_id=os.environ["KOB_PROGRAM_ID"],
    initial_funding=25,
)
```

## Webhooks

Events are signed with `x-korapay-signature` (HMAC-SHA256 of the raw body using your tenant's webhook secret). Always verify the signature before processing.

| Event                      | Description                                  |
|----------------------------|----------------------------------------------|
| `card.issued`              | A new card has been issued                   |
| `card.charged`             | Authorization captured                       |
| `card.refunded`            | Refund posted                                |
| `card.declined`            | Authorization declined                       |
| `card.terminated`          | Card terminated (Kora-side or tenant-side)   |

## Error codes (RFC 7807)

| Code                          | When                                              |
|-------------------------------|---------------------------------------------------|
| `card_validation_failed`      | Missing or invalid input                          |
| `card_not_found`              | Card or cardholder not found                      |
| `card_kyc_required`           | Cardholder lacks required KYC tier                |
| `card_insufficient_funds`     | Withdraw exceeds balance                          |
| `card_terminated`             | Action attempted on a terminated card             |
| `card_provider_unavailable`   | Kora upstream unreachable                         |
| `card_provider_unauthorized`  | Provider rejected credentials (tenant misconfig)  |

## Compliance

- **PCI-DSS v4.0**: Full PAN/CVV is **never persisted** by Kang. Reveal endpoints stream provider data over a short-lived token.
- **FAPI-1.0-Adv**: All write endpoints require step-up MFA above the `card_step_up_threshold`.
- **Standing Order 6 (Version Gate)**: Spec bumped 4.31.0 → 4.32.0 (additive only).

## Migration from legacy Cardyfie issuing

The legacy `/virtual-cards` consumer endpoint remains read-only for archive purposes. New issuance must use `/v1/issuing/`. See the [migration guide](./migration-from-cardyfie.md).
