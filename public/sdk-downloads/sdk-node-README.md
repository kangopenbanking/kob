# @kang/openbanking-node

Official Node.js / TypeScript SDK for the **Kang Open Banking (KOB) v1 API** (v1.2.0).

## Installation

```bash
npm install @kang/openbanking-node
```

## Quick Start

```typescript
import { KangOpenBanking } from '@kang/openbanking-node';

// Sandbox (API Key)
const kob = new KangOpenBanking({
  clientId: 'your_client_id',
  apiKey: 'sbx_your_sandbox_key',
  environment: 'sandbox',
});

// Production (OAuth2)
const kobProd = new KangOpenBanking({
  clientId: 'your_client_id',
  clientSecret: 'your_client_secret',
  environment: 'production',
});
```

## AISP — Account Information

```typescript
// List accounts
const accounts = await kob.accounts.list();

// Get balances
const balances = await kob.balances.get('account_uuid');

// Get transactions (with date filters)
const txns = await kob.transactions.list('account_uuid', {
  from: '2026-01-01',
  to: '2026-03-20',
  page: 1,
  per_page: 50,
});

// Get beneficiaries
const beneficiaries = await kob.beneficiaries.list('account_uuid');
```

## Gateway — Payments

```typescript
// Create a Mobile Money charge
const charge = await kob.charges.create({
  merchant_id: 'mch_uuid',
  amount: 5000,
  currency: 'XAF',
  channel: 'mobile_money',
  customer_phone: '237677123456',
  tx_ref: 'order_001',
});

// Verify charge
const verified = await kob.charges.verify(charge.id);

// Estimate fees
const fees = await kob.gateway.estimateFee({
  amount: 5000,
  channel: 'mobile_money',
  currency: 'XAF',
});

// Create refund
const refund = await kob.refunds.create({
  charge_id: charge.id,
  amount: 2500,
  reason: 'Customer request',
});

// Create payout
const payout = await kob.payouts.create({
  merchant_id: 'mch_uuid',
  amount: 10000,
  currency: 'XAF',
  channel: 'mobile_money',
  beneficiary_name: 'Jean Nkomo',
  beneficiary_account: '237677654321',
});
```

## OAuth2 — Authorization Code + PKCE

```typescript
// Build authorization URL
const authUrl = kob.auth.buildAuthorizationUrl({
  redirectUri: 'https://yourapp.com/callback',
  scope: 'openid accounts payments',
  codeChallenge: 'your_pkce_challenge',
  codeChallengeMethod: 'S256',
});

// Exchange code for token (on callback)
const token = await kob.auth.getToken({
  grant_type: 'authorization_code',
  client_id: 'your_client_id',
  code: 'received_code',
  redirect_uri: 'https://yourapp.com/callback',
  code_verifier: 'your_pkce_verifier',
});

kob.setAccessToken(token.access_token, token.expires_in);
```

## Webhook Verification

```typescript
const isValid = await kob.verifyWebhookSignature(
  rawBody,
  signatureHeader,
  'your_webhook_secret'
);
```

## Sandbox Tools

```typescript
// Create test account
const account = await kob.sandbox.createAccount({
  account_holder_name: 'Test User',
  currency: 'XAF',
});

// Generate test data
await kob.sandbox.generateData({ type: 'transactions', count: 50 });

// Register webhook
await kob.webhooks.register({
  url: 'https://webhook.site/your-id',
  events: ['charge.successful', 'payout.completed'],
});
```

## Error Handling

```typescript
import { KOBError } from '@kang/openbanking-node';

try {
  const charge = await kob.charges.create({ ... });
} catch (err) {
  if (err instanceof KOBError) {
    console.error(`[${err.errorCode}] ${err.message} (${err.errorId})`);
    console.error(`HTTP ${err.statusCode}`);
  }
}
```

## Rate Limits

| Endpoint | Limit |
|---|---|
| Token endpoint | 100/hour per client |
| AISP endpoints | 1,000/hour per consent |
| PISP endpoints | 500/hour per client |
| Gateway endpoints | 1,000/hour per merchant |

HTTP 429 responses include a `Retry-After` header.

## Links

- [API Documentation](https://kangopenbanking.com/developer)
- [Getting Started](https://kangopenbanking.com/developer/getting-started)
- [OpenAPI Spec](https://kangopenbanking.com/openapi.json)
- [Sandbox Spec](https://kangopenbanking.com/openapi-sandbox.json)
- [Postman Collection](https://kangopenbanking.com/developer/guides/postman)
- [API Status](https://kangopenbanking.com/developer/status)
- Email: developers@kangopenbanking.com

## License

MIT
