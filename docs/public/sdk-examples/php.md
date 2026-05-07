# PHP / Laravel

```bash
composer require kangopenbanking/sdk
```

## Initialise

```php
use KangOpenBanking\KOBClient;

$kob = new KOBClient([
    'client_id'     => env('KANG_CLIENT_ID'),
    'client_secret' => env('KANG_CLIENT_SECRET'),
    'environment'   => 'sandbox',
]);
```

## Create a charge

```php
$charge = $kob->gateway->charges->create([
    'amount'         => 50000,
    'currency'       => 'XAF',
    'channel'        => 'mobile_money',
    'customer_phone' => '+237670000000',
    'tx_ref'         => (string) Str::uuid(),
], ['idempotency_key' => (string) Str::uuid()]);
```

## Retry with exponential backoff

```php
function withRetry(callable $fn, int $max = 5) {
    for ($i = 0; $i < $max; $i++) {
        try { return $fn(); }
        catch (\KangOpenBanking\Exceptions\KOBException $e) {
            if (!in_array($e->status, [429, 500, 502, 503, 504]) || $i === $max - 1) throw $e;
            sleep($e->retryAfter ?? min(2 ** $i, 30));
        }
    }
}
```

## Verify a webhook (Laravel)

```php
public function handle(Request $request) {
    $ts  = $request->header('X-Webhook-Timestamp');
    $sig = $request->header('X-Webhook-Signature');
    abort_if(abs(time() - (int) $ts) > 300, 400);

    $expected = hash_hmac('sha256', $ts . '.' . $request->getContent(), config('kob.webhook_secret'));
    abort_unless(hash_equals($expected, $sig), 401);
}
```
