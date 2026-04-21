# Kang Open Banking — Quick Start Guide

> Get from zero to your first API call in 5 minutes.

## Prerequisites

| Requirement | Details |
|---|---|
| TPP Registration | Approved via [kangopenbanking.com/tpp-registration](https://kangopenbanking.com/tpp-registration) |
| Base URL | `https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1` |
| Auth | OAuth 2.0 `client_credentials` or `authorization_code` |

---

## Step 1 — Register via Dynamic Client Registration (DCR)

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/dcr/register \
  -H "Content-Type: application/json" \
  -d '{
    "software_statement": "YOUR_SSA_JWT",
    "redirect_uris": ["https://yourapp.com/callback"],
    "grant_types": ["client_credentials", "authorization_code"],
    "scope": "openid accounts payments"
  }'
```

**Response:**
```json
{
  "client_id": "sk_live_xxxxxxxx",
  "client_secret": "kob_secret_xxxxxxxx",
  "grant_types": ["client_credentials", "authorization_code"],
  "scope": "openid accounts payments"
}
```

## Step 2 — Obtain an Access Token

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "scope=accounts"
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "accounts"
}
```

## Step 3 — Health Check

```bash
curl https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/health
```

## Step 4 — Create an AISP Consent & List Accounts

### 4a. Create Consent

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/aisp/consents \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "Data": {
      "Permissions": ["ReadAccountsBasic","ReadBalances","ReadTransactionsBasic"],
      "ExpirationDateTime": "2026-12-31T23:59:59Z"
    }
  }'
```

### 4b. List Accounts

```bash
curl https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/aisp/accounts \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "x-consent-id: consent_abc123"
```

---

## SDK Quickstart Examples

### JavaScript / Node.js

```javascript
const KOB_BASE = "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1";

// Step 1: Obtain an access token
async function getToken(clientId, clientSecret) {
  const res = await fetch(`${KOB_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "accounts payments",
    }),
  });
  const data = await res.json();
  return data.access_token;
}

// Step 2: List accounts
async function listAccounts(token, consentId) {
  const res = await fetch(`${KOB_BASE}/aisp/accounts`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-consent-id": consentId,
    },
  });
  return res.json();
}

// Step 3: Initiate a payment
async function createPayment(token, paymentData) {
  const res = await fetch(`${KOB_BASE}/pisp/domestic-payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(paymentData),
  });
  return res.json();
}

// Usage
(async () => {
  const token = await getToken("sk_live_xxx", "kob_secret_xxx");
  const accounts = await listAccounts(token, "consent_abc123");
  console.log("Accounts:", accounts);
})();
```

### Python

```python
import requests
import uuid

KOB_BASE = "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1"

# Step 1: Obtain an access token
def get_token(client_id: str, client_secret: str) -> str:
    resp = requests.post(
        f"{KOB_BASE}/oauth/token",
        data={
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
            "scope": "accounts payments",
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    resp.raise_for_status()
    return resp.json()["access_token"]

# Step 2: List accounts
def list_accounts(token: str, consent_id: str) -> dict:
    resp = requests.get(
        f"{KOB_BASE}/aisp/accounts",
        headers={
            "Authorization": f"Bearer {token}",
            "x-consent-id": consent_id,
        },
    )
    resp.raise_for_status()
    return resp.json()

# Step 3: Initiate a payment
def create_payment(token: str, payment_data: dict) -> dict:
    resp = requests.post(
        f"{KOB_BASE}/pisp/domestic-payments",
        json=payment_data,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Idempotency-Key": str(uuid.uuid4()),
        },
    )
    resp.raise_for_status()
    return resp.json()

# Usage
if __name__ == "__main__":
    token = get_token("sk_live_xxx", "kob_secret_xxx")
    accounts = list_accounts(token, "consent_abc123")
    print("Accounts:", accounts)
```

### PHP

```php
<?php
$KOB_BASE = "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1";

// Step 1: Obtain an access token
function getToken(string $clientId, string $clientSecret): string {
    $ch = curl_init("$GLOBALS[KOB_BASE]/oauth/token");
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ["Content-Type: application/x-www-form-urlencoded"],
        CURLOPT_POSTFIELDS => http_build_query([
            "grant_type"    => "client_credentials",
            "client_id"     => $clientId,
            "client_secret" => $clientSecret,
            "scope"         => "accounts payments",
        ]),
    ]);
    $resp = json_decode(curl_exec($ch), true);
    curl_close($ch);
    return $resp["access_token"];
}

// Step 2: List accounts
function listAccounts(string $token, string $consentId): array {
    $ch = curl_init("$GLOBALS[KOB_BASE]/aisp/accounts");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer $token",
            "x-consent-id: $consentId",
        ],
    ]);
    $resp = json_decode(curl_exec($ch), true);
    curl_close($ch);
    return $resp;
}

// Step 3: Initiate a payment
function createPayment(string $token, array $paymentData): array {
    $ch = curl_init("$GLOBALS[KOB_BASE]/pisp/domestic-payments");
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer $token",
            "Content-Type: application/json",
            "Idempotency-Key: " . bin2hex(random_bytes(16)),
        ],
        CURLOPT_POSTFIELDS => json_encode($paymentData),
    ]);
    $resp = json_decode(curl_exec($ch), true);
    curl_close($ch);
    return $resp;
}

// Usage
$token = getToken("sk_live_xxx", "kob_secret_xxx");
$accounts = listAccounts($token, "consent_abc123");
print_r($accounts);
```

---

## Next Steps

- [Authentication Guide](authentication.md) — OAuth grants, DCR, mTLS
- [AISP Guide](aisp-guide.md) — Full account information API
- [PISP Guide](pisp-guide.md) — Payment initiation
- [Webhooks Guide](webhooks.md) — Webhook subscription & verification
- [Error Reference](error-reference.md) — All error codes
- [Flutterwave Setup](flutterwave-setup.md) — Mobile money integration
