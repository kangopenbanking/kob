# @kangopenbanking/sdk

Official Node.js / TypeScript SDK for the **Kang Open Banking (KOB) API**.

- npm: https://www.npmjs.com/package/@kangopenbanking/sdk
- API docs: https://kangopenbanking.com/developer
- OpenAPI spec: https://kangopenbanking.com/openapi.json
- Sandbox spec: https://kangopenbanking.com/openapi-sandbox.json
- Status: https://kangopenbanking.com/developer/status

## Requirements

- Node.js 16+ (uses native `fetch` and `crypto.subtle`)
- TypeScript 5+ (optional — full typings shipped)

## Installation

```bash
npm install @kangopenbanking/sdk
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

When a `clientSecret` is provided, the SDK fetches, caches, and refreshes
the access token automatically:

```typescript
import { KangOpenBanking } from '@kangopenbanking/sdk';

const kob = new KangOpenBanking({
  clientId: process.env.KOB_CLIENT_ID!,
  clientSecret: process.env.KOB_CLIENT_SECRET!,
  environment: 'production',
});

// First API call triggers the token fetch automatically.
const accounts = await kob.accounts.list();
```

You can also fetch a token explicitly:

```typescript
const token = await kob.auth.getToken({
  grant_type: 'client_credentials',
  client_id: process.env.KOB_CLIENT_ID!,
  client_secret: process.env.KOB_CLIENT_SECRET!,
  scope: 'accounts payments',
});
```

### Authorization Code + PKCE (user-delegated)

The SDK helps you build the authorization URL and exchange the returned
code. **PKCE verifier/challenge generation and storage are your
application's responsibility** — generate them and persist them alongside
the user's session.

```typescript
import { createHash, randomBytes } from 'node:crypto';

// 1. Generate PKCE in your app:
const verifier = randomBytes(64).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');

// 2. Build the authorization URL and redirect the user.
const authUrl = kob.auth.buildAuthorizationUrl({
  redirectUri: 'https://yourapp.com/callback',
  scope: 'openid accounts payments',
  state: 'random-csrf-token',
  codeChallenge: challenge,
  codeChallengeMethod: 'S256',
});

// 3. On callback, exchange the code for an access token.
const token = await kob.auth.getToken({
  grant_type: 'authorization_code',
  client_id: process.env.KOB_CLIENT_ID!,
  code: callbackCode,
  redirect_uri: 'https://yourapp.com/callback',
  code_verifier: verifier,
});

kob.setAccessToken(token.access_token, token.expires_in);
```

The SDK does **not** persist tokens for you. Store them in your session,
cache, or database according to your security model.

### Sandbox API key

For quick sandbox testing, you can skip OAuth by passing an `sbx_…` key.
The SDK sends it as `X-API-Key`:

```typescript
const kob = new KangOpenBanking({
  clientId: 'your_client_id',
  apiKey: 'sbx_your_sandbox_key',
  environment: 'sandbox',
});
```

## Quick start

```typescript
import { KangOpenBanking } from '@kangopenbanking/sdk';

const kob = new KangOpenBanking({
  clientId: process.env.KOB_CLIENT_ID!,
  clientSecret: process.env.KOB_CLIENT_SECRET!,
  environment: 'sandbox',
});

// AISP — list a user's accounts
const accounts = await kob.accounts.list();

// Gateway — create a Mobile Money charge
const charge = await kob.charges.create({
  merchant_id: 'mch_uuid',
  amount: 5000,
  currency: 'XAF',
  channel: 'mobile_money',
  customer_phone: '237677123456',
  tx_ref: 'order_001',
});

// Verify the charge status
const verified = await kob.charges.verify(charge.id);
```

## Available resources

These match the public properties exposed by `KangOpenBanking` (see
`src/client.ts`):

| Property              | Class                  |
| --------------------- | ---------------------- |
| `kob.auth`            | `AuthResource`         |
| `kob.accounts`        | `AccountsResource`     |
| `kob.balances`        | `BalancesResource`     |
| `kob.transactions`    | `TransactionsResource` |
| `kob.beneficiaries`   | `BeneficiariesResource`|
| `kob.charges`         | `ChargesResource`      |
| `kob.refunds`         | `RefundsResource`      |
| `kob.payouts`         | `PayoutsResource`      |
| `kob.gateway`         | `GatewayResource`      |
| `kob.sandbox`         | `SandboxResource`      |
| `kob.webhooks`        | `WebhooksResource`     |

Additional resources exported separately: `MerchantOpsResource`,
`GlobalAccountsResource`, and the `qr` helper (see `src/index.ts`).

## AISP — Account information

```typescript
const accounts = await kob.accounts.list();
const balances = await kob.balances.get('account_uuid');
const txns = await kob.transactions.list('account_uuid', {
  from: '2026-01-01',
  to: '2026-03-20',
  page: 1,
  per_page: 50,
});
const beneficiaries = await kob.beneficiaries.list('account_uuid');
```

## Gateway — Payments

```typescript
const charge = await kob.charges.create({
  merchant_id: 'mch_uuid',
  amount: 5000,
  currency: 'XAF',
  channel: 'mobile_money',
  customer_phone: '237677123456',
  tx_ref: 'order_001',
});

const fees = await kob.gateway.estimateFee({
  amount: 5000,
  channel: 'mobile_money',
  currency: 'XAF',
});

const refund = await kob.refunds.create({
  charge_id: charge.id,
  amount: 2500,
  reason: 'Customer request',
});

const payout = await kob.payouts.create({
  merchant_id: 'mch_uuid',
  amount: 10000,
  currency: 'XAF',
  channel: 'mobile_money',
  beneficiary_name: 'Jean Nkomo',
  beneficiary_account: '237677654321',
});
```

## Webhook verification

```typescript
const isValid = await kob.verifyWebhookSignature(
  rawBody,
  signatureHeader,
  process.env.KOB_WEBHOOK_SECRET!
);
```

Deterministic signed test fixtures for `charge.succeeded` and `account.updated`
are published at
[`/sdk-downloads/webhook-fixtures/`](https://kangopenbanking.com/sdk-downloads/webhook-fixtures/README.md)
so you can prove your receiver accepts canonical events and rejects tampered
ones without hitting the sandbox.

## End-to-end PKCE example

A runnable Node sample that performs OAuth 2.0 + PKCE (RFC 7636 §4) against
the sandbox lives at
[`examples/pkce-auth-code.ts`](./examples/pkce-auth-code.ts). It captures the
redirect on `127.0.0.1`, exchanges the code at `/oauth/token`, and probes
`/health` with the returned bearer.


## Error handling

```typescript
import { KOBError } from '@kangopenbanking/sdk';

try {
  const charge = await kob.charges.create({ /* … */ });
} catch (err) {
  if (err instanceof KOBError) {
    console.error(`[${err.errorCode}] ${err.message} (${err.errorId})`);
    console.error(`HTTP ${err.statusCode}`);
  }
}
```

## Sandbox tools

```typescript
const account = await kob.sandbox.createAccount({
  account_holder_name: 'Test User',
  currency: 'XAF',
});

await kob.sandbox.generateData({ type: 'transactions', count: 50 });

await kob.webhooks.register({
  url: 'https://webhook.site/your-id',
  events: ['charge.successful', 'payout.completed'],
});
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

- Node.js (this package) — https://www.npmjs.com/package/@kangopenbanking/sdk
- Python — https://pypi.org/project/kangopenbanking/
- PHP — https://packagist.org/packages/kangopenbanking/sdk

## Support

- Email: developers@kangopenbanking.com
- Docs: https://kangopenbanking.com/developer

## License

MIT
