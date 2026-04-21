# Institution Quickstart — Open Banking Integration

> Connect your bank, credit union, or MFI to the KOB platform.

## 1. Register Your Institution

Sign up at [kangopenbanking.com/auth](https://kangopenbanking.com/auth) → **"Open Banking APIs"**.

Provide:
- Institution legal name
- Registration number
- Country (e.g., CM — Cameroon)
- Contact email and phone: `+237 6XX XXX XXX`

## 2. Submit KYB Documents

Upload required compliance documents:
- Certificate of incorporation
- Board resolution authorizing API access
- Proof of address
- Authorized signatory ID

Track progress in **FI Portal → KYB Status**.

## 3. Receive Credentials

After admin approval:
- **Sandbox credentials**: auto-issued for testing
- **Production credentials**: issued after compliance review
- **OAuth client**: register via DCR or request admin provisioning

## 4. Register OAuth Client (DCR)

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/dcr-register \
  -H "Content-Type: application/json" \
  -d '{
    "software_statement": "eyJhbGciOi...",
    "redirect_uris": ["https://yourbank.cm/callback"],
    "grant_types": ["client_credentials", "authorization_code"],
    "scope": "openid accounts balances transactions payments offline_access"
  }'
```

Response:
```json
{
  "client_id": "sk_live_xxxxxxxx",
  "client_secret": "kob_secret_xxxxxxxx",
  "client_id_issued_at": 1739750400
}
```

## 5. AISP — Account Information

### Create Consent
```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/aisp-create-consent \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "permissions": ["ReadAccountsBasic", "ReadBalances", "ReadTransactionsDetail"],
    "expiration_date": "2026-12-31T23:59:59Z"
  }'
```

### Fetch Accounts
```bash
curl https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/aisp-accounts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Consent-ID: CONSENT_ID"
```

### Fetch Transactions (XAF)
```bash
curl "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/aisp-transactions?account_id=ACC_UUID&from=2026-01-01&to=2026-03-15" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 6. PISP — Payment Initiation

### Create Payment Consent
```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/pisp-create-consent \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "debtor_account": "CM21 10003 00100 0123456789 023",
    "creditor_account": "CM21 10003 00200 9876543210 045",
    "amount": 50000,
    "currency": "XAF",
    "reference": "Invoice-2026-001"
  }'
```

### Submit Payment
```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/pisp-domestic-payment \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{ "consent_id": "CONSENT_ID" }'
```

## 7. Cameroon Account Formats

KOB supports Cameroon-specific account identification:

| Scheme | Format | Example |
|---|---|---|
| `DOMESTIC_RIB` | 23-digit RIB | `10005001000123456789023` |
| `LOCAL_BANK` | Bank code + account | `10005-0123456789` |
| `MOMO` | Phone number | `237650000000` |
| `IBAN` | CM + check + RIB | `CM21 10005 00100 01234567890 23` |

Validate any format:
```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/validate-account-identifier \
  -d '{ "type": "DOMESTIC_RIB", "value": "10005001000123456789023", "country": "CM" }'
```

## 8. mTLS (Production)

Upload your X.509 certificate for certificate-bound tokens:
```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/certificate-upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "certificate=@client-cert.pem" \
  -F "certificate_type=transport"
```

## Next Steps

- [OAuth & OIDC Reference](/docs/portal/authentication.md)
- [Error Codes](/docs/public/errors.md)
- [Status Lifecycle](/docs/public/statuses.md)
- [ISO 20022 / SWIFT Tools](/docs/public/standards.md)
