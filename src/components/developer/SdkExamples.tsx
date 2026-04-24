import { CodeBlock } from "@/components/developer/CodeBlock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Code2 } from "lucide-react";

const TOKEN_URL = "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/oauth-token";
const TX_URL = "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/aisp/transactions";

/* ─── 1. OAuth — Client Credentials grant ─────────────────────────────── */

const oauthCurl = `# Exchange your client_id / client_secret for a bearer token
curl -X POST ${TOKEN_URL} \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=client_credentials" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET" \\
  -d "scope=accounts:read transactions:read"

# 200 OK
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 900,
  "refresh_token": "rt_a91f...c4",
  "scope": "accounts:read transactions:read"
}`;

const oauthJs = `// Node.js / browser — fetch
const params = new URLSearchParams({
  grant_type: 'client_credentials',
  client_id: process.env.KOB_CLIENT_ID,
  client_secret: process.env.KOB_CLIENT_SECRET,
  scope: 'accounts:read transactions:read',
});

const res = await fetch('${TOKEN_URL}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: params,
});
const { access_token, refresh_token, expires_in } = await res.json();
console.log('Token valid for', expires_in, 'seconds');`;

const oauthPy = `# Python — requests
import os, requests

resp = requests.post(
    '${TOKEN_URL}',
    data={
        'grant_type': 'client_credentials',
        'client_id': os.environ['KOB_CLIENT_ID'],
        'client_secret': os.environ['KOB_CLIENT_SECRET'],
        'scope': 'accounts:read transactions:read',
    },
    timeout=10,
)
resp.raise_for_status()
token = resp.json()
print(f"Token valid for {token['expires_in']}s")`;

/* ─── 2. Token refresh ─────────────────────────────────────────────────── */

const refreshCurl = `# Rotate the refresh_token (single-use, OAuth 2.1 §6.1)
curl -X POST ${TOKEN_URL} \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=refresh_token" \\
  -d "refresh_token=rt_a91f...c4" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET"

# 200 OK — note: refresh_token in the response is NEW; discard the old one
{
  "access_token": "eyJhbGciOi...new",
  "token_type": "Bearer",
  "expires_in": 900,
  "refresh_token": "rt_b22e...91",
  "scope": "accounts:read transactions:read"
}`;

const refreshJs = `// Auto-refresh helper — call before each request when expiry < 60s
async function refreshAccessToken(refreshToken) {
  const res = await fetch('${TOKEN_URL}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.KOB_CLIENT_ID,
      client_secret: process.env.KOB_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error('Refresh failed — re-authenticate the user');
  // IMPORTANT: persist the NEW refresh_token, the old one is now invalid
  return res.json();
}`;

const refreshPy = `import requests

def refresh_access_token(refresh_token: str, client_id: str, client_secret: str) -> dict:
    """Rotates the refresh token. Persist the NEW value — the old one is invalid."""
    resp = requests.post(
        '${TOKEN_URL}',
        data={
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token,
            'client_id': client_id,
            'client_secret': client_secret,
        },
        timeout=10,
    )
    if resp.status_code == 401:
        raise RuntimeError('Refresh token revoked — re-authenticate the user')
    resp.raise_for_status()
    return resp.json()`;

/* ─── 3. OBIE-shaped Transaction call ──────────────────────────────────── */

const obieCurl = `# Request transactions in OBIE Read/Write Data API v3.1 shape
curl -X GET "${TX_URL}?account_id=acc_8f1d&format=obie" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "x-consent-id: cns_2024_a1b2"

# 200 OK — TransactionOBIE schema (PascalCase, OBIE 3.1.10)
{
  "data": [
    {
      "AccountId": "acc_8f1d",
      "TransactionId": "txn_1f2e3d",
      "Amount": { "Amount": "5000", "Currency": "XAF" },
      "CreditDebitIndicator": "Debit",
      "BookingDateTime": "2026-04-23T14:32:11Z",
      "ValueDateTime": "2026-04-23T14:32:11Z",
      "TransactionInformation": "MTN MoMo charge — order #1842",
      "Status": "Booked"
    }
  ],
  "meta": { "total": 1, "schema": "TransactionOBIE" }
}`;

const obieJs = `// Fetch and map a TransactionOBIE response into your domain model
const res = await fetch(
  '${TX_URL}?account_id=acc_8f1d&format=obie',
  {
    headers: {
      Authorization: \`Bearer \${accessToken}\`,
      'x-consent-id': consentId,
    },
  }
);

const { data } = await res.json();

const normalised = data.map((tx) => ({
  id: tx.TransactionId,
  accountId: tx.AccountId,
  // Always parse as integer minor units — never as float
  amountMinor: BigInt(tx.Amount.Amount),
  currency: tx.Amount.Currency,
  direction: tx.CreditDebitIndicator === 'Credit' ? 'in' : 'out',
  bookedAt: new Date(tx.BookingDateTime),
  description: tx.TransactionInformation,
  status: tx.Status.toLowerCase(),
}));`;

const obiePy = `import requests
from decimal import Decimal
from datetime import datetime

resp = requests.get(
    '${TX_URL}',
    params={'account_id': 'acc_8f1d', 'format': 'obie'},
    headers={
        'Authorization': f'Bearer {access_token}',
        'x-consent-id': consent_id,
    },
    timeout=10,
)
resp.raise_for_status()

normalised = [
    {
        'id': tx['TransactionId'],
        'account_id': tx['AccountId'],
        # String minor units → Decimal, never float
        'amount_minor': Decimal(tx['Amount']['Amount']),
        'currency': tx['Amount']['Currency'],
        'direction': 'in' if tx['CreditDebitIndicator'] == 'Credit' else 'out',
        'booked_at': datetime.fromisoformat(tx['BookingDateTime'].rstrip('Z')),
        'description': tx['TransactionInformation'],
        'status': tx['Status'].lower(),
    }
    for tx in resp.json()['data']
]`;

function ExampleCard({
  title,
  description,
  examples,
}: {
  title: string;
  description: string;
  examples: { language: string; label: string; code: string }[];
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Code2 className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <CodeBlock examples={examples} />
      </CardContent>
    </Card>
  );
}

export function SdkExamples() {
  return (
    <div className="space-y-6 my-6">
      <ExampleCard
        title="1. OAuth — obtain an access token"
        description="Client credentials grant. Cache the access_token for its full expires_in window (15 min)."
        examples={[
          { language: "bash", label: "cURL", code: oauthCurl },
          { language: "javascript", label: "Node.js", code: oauthJs },
          { language: "python", label: "Python", code: oauthPy },
        ]}
      />

      <ExampleCard
        title="2. Refresh an expired access token"
        description="Refresh tokens are single-use (OAuth 2.1 §6.1) — every successful refresh issues a NEW refresh_token. Persist it immediately."
        examples={[
          { language: "bash", label: "cURL", code: refreshCurl },
          { language: "javascript", label: "Node.js", code: refreshJs },
          { language: "python", label: "Python", code: refreshPy },
        ]}
      />

      <ExampleCard
        title="3. Fetch transactions in the OBIE shape (TransactionOBIE)"
        description="Pass ?format=obie to receive PascalCase fields aligned with OBIE Read/Write Data API v3.1.10. Amount.Amount is a string in minor units — parse with BigInt or Decimal."
        examples={[
          { language: "bash", label: "cURL", code: obieCurl },
          { language: "javascript", label: "Node.js", code: obieJs },
          { language: "python", label: "Python", code: obiePy },
        ]}
      />
    </div>
  );
}
