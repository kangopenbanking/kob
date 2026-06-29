# kangopenbanking/sdk — v1.1.2

Official PHP SDK for the **Kang Open Banking (KOB) API** with first-class Laravel support.

- Packagist: https://packagist.org/packages/kangopenbanking/sdk
- API docs: https://kangopenbanking.com/developer
- OpenAPI spec: https://kangopenbanking.com/openapi.json
- Sandbox spec: https://kangopenbanking.com/openapi-sandbox.json
- Status: https://kangopenbanking.com/developer/status

## Requirements

- PHP 8.1+
- Guzzle 7+

## Installation

```bash
composer require kangopenbanking/sdk
```

### Laravel auto-discovery

The service provider and facade are auto-discovered. Publish the config with:

```bash
php artisan vendor:publish --tag=kob-config
```

Then set in `.env`:

```env
KOB_CLIENT_ID=your_client_id
KOB_CLIENT_SECRET=your_client_secret      # required for client_credentials
KOB_API_KEY=sbx_your_sandbox_key          # optional sandbox shortcut
KOB_ENVIRONMENT=sandbox                    # sandbox | production
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

The SDK handles the token request, caching, and refresh for you when a
`client_secret` is provided:

```php
use KangOpenBanking\KangOpenBanking;

$kob = new KangOpenBanking([
    'client_id'     => getenv('KOB_CLIENT_ID'),
    'client_secret' => getenv('KOB_CLIENT_SECRET'),
    'environment'   => 'production',
]);

// First API call triggers a token fetch + cache automatically.
$accounts = $kob->accounts->list();
```

You can also fetch a token explicitly:

```php
$token = $kob->getToken([
    'grant_type' => 'client_credentials',
    'scope'      => 'accounts payments',
]);
```

### Authorization Code + PKCE (user-delegated)

The SDK helps you build the authorization URL and exchange the returned code
for a token. **PKCE verifier/challenge generation and storage are your
application's responsibility** — generate them with your framework and persist
them alongside the user's session.

```php
// 1. Generate PKCE in your app (example helper):
$verifier  = rtrim(strtr(base64_encode(random_bytes(64)), '+/', '-_'), '=');
$challenge = rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');

// 2. Build the authorization URL and redirect the user.
$authUrl = $kob->buildAuthorizationUrl([
    'redirect_uri'          => 'https://yourapp.com/callback',
    'scope'                 => 'openid accounts payments',
    'state'                 => $state,
    'code_challenge'        => $challenge,
    'code_challenge_method' => 'S256',
]);

// 3. On callback, exchange the code for an access token.
$token = $kob->getToken([
    'grant_type'    => 'authorization_code',
    'code'          => $_GET['code'],
    'redirect_uri'  => 'https://yourapp.com/callback',
    'code_verifier' => $verifier,
]);

$kob->setAccessToken($token['access_token'], $token['expires_in']);
```

The SDK does **not** persist tokens for you. Store them in your session,
cache, or database according to your security model.

### Sandbox API key

For quick sandbox testing, you can skip OAuth entirely by passing an
`sbx_…` key. The SDK will send it as `X-API-Key`:

```php
$kob = new KangOpenBanking([
    'client_id'   => 'your_client_id',
    'api_key'     => 'sbx_your_sandbox_key',
    'environment' => 'sandbox',
]);
```

## Quick start

```php
use KangOpenBanking\KangOpenBanking;

$kob = new KangOpenBanking([
    'client_id'     => getenv('KOB_CLIENT_ID'),
    'client_secret' => getenv('KOB_CLIENT_SECRET'),
    'environment'   => 'sandbox',
]);

// AISP — list a user's accounts
$accounts = $kob->accounts->list();

// Gateway — create a Mobile Money charge
$charge = $kob->charges->create([
    'merchant_id'    => 'mch_uuid',
    'amount'         => 5000,
    'currency'       => 'XAF',
    'channel'        => 'mobile_money',
    'customer_phone' => '237677123456',
    'tx_ref'         => 'order_001',
]);

// Verify the charge status
$verified = $kob->charges->verify($charge['id']);
```

## Available resources

These match the public methods exposed by `KangOpenBanking\KangOpenBanking`
(see `src/KangOpenBanking.php`):

| Property               | Class                       |
| ---------------------- | --------------------------- |
| `$kob->accounts`       | `AccountsResource`          |
| `$kob->balances`       | `BalancesResource`          |
| `$kob->transactions`   | `TransactionsResource`      |
| `$kob->beneficiaries`  | `BeneficiariesResource`     |
| `$kob->charges`        | `ChargesResource`           |
| `$kob->refunds`        | `RefundsResource`           |
| `$kob->payouts`        | `PayoutsResource`           |
| `$kob->gateway`        | `GatewayResource`           |
| `$kob->sandbox`        | `SandboxResource`           |
| `$kob->webhooks`       | `WebhooksResource`          |
| `$kob->payByBank`      | `PayByBankResource`         |
| `$kob->globalAccounts` | `GlobalAccountsResource`    |

## Webhook verification

```php
use KangOpenBanking\KangOpenBanking;

$isValid = KangOpenBanking::verifyWebhookSignature(
    $rawBody,
    $signatureHeader,
    getenv('KOB_WEBHOOK_SECRET')
);
```

Deterministic signed test fixtures for `charge.succeeded` and `account.updated`
are published at
[`/sdk-downloads/webhook-fixtures/`](https://kangopenbanking.com/sdk-downloads/webhook-fixtures/README.md)
and are verified on every push and nightly by `.github/workflows/webhook-signature-smoke.yml`.

### Laravel middleware

```php
use KangOpenBanking\Laravel\Middleware\VerifyWebhookSignature;

Route::post('/webhooks/kob', [WebhookController::class, 'handle'])
    ->middleware(VerifyWebhookSignature::class);
```

## Error handling

```php
use KangOpenBanking\Exceptions\KOBException;

try {
    $charge = $kob->charges->create([ /* … */ ]);
} catch (KOBException $e) {
    // $e->getMessage(), $e->statusCode, $e->errorCode, $e->errorId
}
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

- Node.js — https://www.npmjs.com/package/@kangopenbanking/sdk
- Python — https://pypi.org/project/kangopenbanking/
- PHP (this package) — https://packagist.org/packages/kangopenbanking/sdk

## Support

- Email: developers@kangopenbanking.com
- Docs: https://kangopenbanking.com/developer

## License

MIT
