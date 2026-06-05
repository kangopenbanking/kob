# Global Virtual Accounts (Nium)

Issue **real USD, EUR, or GBP bank accounts** for your users. Funds
received from any global payer (YouTube, TikTok, marketplace, employer)
are converted to **XAF** at the Nium FX rate (plus a configurable spread),
then routed to the user's **Kang Wallet** or **Mobile Money** wallet
via Flutterwave.

> Replaces the NGN-only `/v1/gateway/virtual-accounts` rails for global
> creator payouts. Legacy endpoints stay live until v5 (see Standing Order 1).

---

## 1. Create a global account

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/nium-create-global-account \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currency":"USD","beneficiary_name":"Jane Influencer"}'
```

```javascript
const res = await fetch(`${KOB_BASE}/nium-create-global-account`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ currency: 'USD' }),
});
const { account } = await res.json();
console.log(account.account_number, account.routing_code, account.bank_name);
```

```python
import requests
r = requests.post(
    f"{KOB_BASE}/nium-create-global-account",
    headers={"Authorization": f"Bearer {token}"},
    json={"currency": "EUR"},
)
acc = r.json()["account"]
print(acc["iban"], acc["bic"], acc["bank_name"])
```

### Response — `201 Created`

```json
{
  "account": {
    "id": "f1d6...",
    "currency": "USD",
    "account_number": "912345678",
    "routing_code": "021000021",
    "bic": "CHASUS33",
    "bank_name": "JPMorgan Chase (via Nium)",
    "bank_address": "383 Madison Ave, New York, NY 10179",
    "beneficiary_name": "Jane Influencer",
    "status": "active",
    "mode": "stub"
  },
  "reused": false
}
```

Calling again with the same currency returns `200 OK` with `reused: true`
— the operation is idempotent per `(user, currency)`.

---

## 2. Set cash-out preference

### User-level default

```bash
curl -X PATCH https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/nium-update-payout-preference \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scope":"user","payout_preference":"MOBILE_MONEY","payout_channel":"237677123456"}'
```

### Per-account override

```bash
curl -X PATCH https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/nium-update-payout-preference \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"scope":"account","account_id":"f1d6...","payout_preference_override":"KANG_WALLET"}'
```

The webhook resolves routing in this order: **account override → user default → KANG_WALLET**.

---

## 3. Webhook — receive incoming payments

Nium calls your KOB instance at:

```
POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/nium-webhook
```

The body is signed with HMAC-SHA256 over the raw body using
`NIUM_WEBHOOK_SECRET` and sent in the `x-nium-signature` header.

### Settlement math

```
xaf_gross         = source_amount * fx_rate_nium
xaf_spread_rev    = xaf_gross * (fx_spread_bps / 10000)        # platform revenue
xaf_after_spread  = xaf_gross - xaf_spread_rev
xaf_withdrawal_fee = max(min_fee, fixed + xaf_after_spread * pct)   # only if MOBILE_MONEY
xaf_net_credited  = xaf_after_spread - xaf_withdrawal_fee
```

Defaults (editable in **Admin → Fee Management**):

| Setting | Default |
|---|---|
| `fx_spread_bps` (transaction_type `nium_fx_spread`) | 75 |
| `nium_withdrawal` | 1% + 100 XAF, min 200 XAF |

### Verifying the signature (Node.js)

```javascript
import crypto from 'node:crypto';
function verifyNium(rawBody, headerSig, secret) {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return expected.length === headerSig.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(headerSig));
}
```

### Sample event

```json
{
  "eventType": "payment_incoming",
  "transactionId": "NIUM_TX_001",
  "accountId": "nium_acc_abc123",
  "amount": 250.00,
  "currency": "USD",
  "senderName": "YouTube Adsense",
  "reference": "Creator payout March 2026"
}
```

---

## 4. Going from stub to live

| Env var | Stub default | Live |
|---|---|---|
| `NIUM_MODE` | `stub` | `live` |
| `NIUM_API_KEY` | unset | required |
| `NIUM_CLIENT_ID` | unset | required |
| `NIUM_BASE_URL` | unused | `https://gateway.nium.com` |
| `NIUM_WEBHOOK_SECRET` | optional | required |

No code change is required to switch — only environment variables.

---

## Related

- Changelog: [v4.50.0](../../changelog.md#v4-50-0)
- Fee Management: [docs](/admin/fee-management)
- Mobile Money payouts (Flutterwave): [Payouts](./payouts.md)
