# kang/openbanking-php

Official PHP SDK for the **Kang Open Banking (KOB) v1 API** (v1.2.0) with Laravel support.

## Requirements

- PHP 8.1+
- Guzzle 7+

## Installation

```bash
composer require kang/openbanking-php
```

### Laravel Auto-Discovery

The service provider and facade are auto-discovered. Publish the config:

```bash
php artisan vendor:publish --tag=kob-config
```

Add to `.env`:

```env
KOB_CLIENT_ID=your_client_id
KOB_API_KEY=sbx_your_sandbox_key
KOB_ENVIRONMENT=sandbox
```

## Quick Start

### Standalone PHP

```php
use KangOpenBanking\KangOpenBanking;

$kob = new KangOpenBanking([
    'client_id' => 'your_client_id',
    'api_key' => 'sbx_your_sandbox_key',
    'environment' => 'sandbox',
]);

// List accounts
$accounts = $kob->accounts->list();

// Create a Mobile Money charge
$charge = $kob->charges->create([
    'merchant_id' => 'mch_uuid',
    'amount' => 5000,
    'currency' => 'XAF',
    'channel' => 'mobile_money',
    'customer_phone' => '237677123456',
    'tx_ref' => 'order_001',
]);

// Verify charge
$verified = $kob->charges->verify($charge['id']);
```

### Laravel (via Facade)

```php
use KangOpenBanking\Laravel\Facades\KOB;

// Uses config/kob.php credentials automatically
$accounts = app(\KangOpenBanking\KangOpenBanking::class)->accounts->list();
```

## AISP — Account Information

```php
$accounts = $kob->accounts->list();
$account = $kob->accounts->get('account_uuid');
$balances = $kob->balances->get('account_uuid');
$transactions = $kob->transactions->list('account_uuid', [
    'from' => '2026-01-01',
    'to' => '2026-03-20',
    'page' => 1,
    'per_page' => 50,
]);
$beneficiaries = $kob->beneficiaries->list('account_uuid');
```

## Gateway — Payments

```php
// Create charge
$charge = $kob->charges->create([
    'merchant_id' => 'mch_uuid',
    'amount' => 5000,
    'currency' => 'XAF',
    'channel' => 'mobile_money',
    'customer_phone' => '237677123456',
    'tx_ref' => 'order_001',
]);

// Estimate fees
$fees = $kob->gateway->estimateFee(5000, 'mobile_money', 'XAF');

// Create refund
$refund = $kob->refunds->create($charge['id'], 2500, 'Customer request');

// Create payout
$payout = $kob->payouts->create([
    'merchant_id' => 'mch_uuid',
    'amount' => 10000,
    'currency' => 'XAF',
    'channel' => 'mobile_money',
    'beneficiary_name' => 'Jean Nkomo',
    'beneficiary_account' => '237677654321',
]);
```

## OAuth2 — Authorization Code + PKCE

```php
// Build authorization URL
$authUrl = $kob->buildAuthorizationUrl([
    'redirect_uri' => 'https://yourapp.com/callback',
    'scope' => 'openid accounts payments',
    'code_challenge' => 'your_pkce_challenge',
    'code_challenge_method' => 'S256',
]);

// Exchange code for token
$token = $kob->getToken([
    'grant_type' => 'authorization_code',
    'code' => $receivedCode,
    'redirect_uri' => 'https://yourapp.com/callback',
    'code_verifier' => 'your_pkce_verifier',
]);

$kob->setAccessToken($token['access_token'], $token['expires_in']);
```

## Webhook Verification

```php
use KangOpenBanking\KangOpenBanking;

$isValid = KangOpenBanking::verifyWebhookSignature(
    $rawBody,
    $signatureHeader,
    'your_webhook_secret'
);
```

### Laravel Middleware

```php
// In routes/api.php
use KangOpenBanking\Laravel\Middleware\VerifyWebhookSignature;

Route::post('/webhooks/kob', [WebhookController::class, 'handle'])
    ->middleware(VerifyWebhookSignature::class);
```

## Error Handling

```php
use KangOpenBanking\Exceptions\KOBException;

try {
    $charge = $kob->charges->create([...]);
} catch (KOBException $e) {
    echo "Error [{$e->errorCode}]: {$e->getMessage()}";
    echo "Error ID: {$e->errorId}";
    echo "HTTP Status: {$e->statusCode}";
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
- [API Status](https://kangopenbanking.com/developer/status)
- Email: developers@kangopenbanking.com

## License

MIT

## PISP Payment Submission (v4.29.3)

As of OpenAPI v4.29.3, `POST /v1/pisp/payment-submission` requires the full payment instruction.

```php
$kob->pisp->submitPayment([
    'payment_id'       => 'pay_abc123',
    'consent_id'       => 'pisp_consent_xyz789',
    'amount'           => '50000',
    'currency'         => 'XAF',
    'debtor_account'   => '10005-00001-09876543210-45',
    'creditor_account' => '10005-00001-12345678901-23',
], ['idempotency_key' => Str::uuid()->toString()]);
```

## Changelog

- **1.2.0** — Aligned to OpenAPI v4.29.3. `submitPayment` now requires
  `payment_id`, `consent_id`, `amount`, `currency`, `debtor_account`,
  `creditor_account`. Removed legacy `instructed_amount` / `risk` fields.
- **1.1.0** — OpenAPI v4.28.x baseline.
