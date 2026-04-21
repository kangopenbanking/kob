# Card Confirmation (Stripe.js)

When you create a charge with `channel: "card"`, the KOB API returns a `next_action` block of type `stripe_confirm_card` containing a Stripe `client_secret` and the publishable key. You complete the payment client-side using Stripe.js so the card number never touches your server (PCI scope SAQ-A).

## Flow

1. **Server** — `POST /v1/gateway/charges` with `channel: "card"` → receive `next_action.client_secret` + `next_action.publishable_key`.
2. **Client (browser)** — Load Stripe.js with the publishable key, mount Stripe Elements, call `stripe.confirmCardPayment(client_secret, …)`. Stripe handles 3DS automatically.
3. **Server** — `POST /v1/gateway/charges/{id}/verify` to finalise on KOB and trigger webhooks.

## Example response

```json
{
  "id": "chg_abc123",
  "channel": "card",
  "status": "pending",
  "next_action": {
    "type": "stripe_confirm_card",
    "client_secret": "pi_3PXX_secret_YYY",
    "publishable_key": "pk_test_…",
    "publishable_key_env": "test",
    "payment_intent_id": "pi_3PXX"
  }
}
```

## Examples

### cURL — create the charge

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-create-charge \
  -H "Authorization: Bearer sk_test_…" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order_12345" \
  -d '{ "amount": 10000, "currency": "XAF", "channel": "card",
        "customer_email": "jane@example.com", "tx_ref": "order_12345" }'
```

### Node.js (browser) — confirm with Stripe.js

```js
import { loadStripe } from "@stripe/stripe-js";

const charge = await fetch("/api/create-charge").then(r => r.json());
const stripe = await loadStripe(charge.next_action.publishable_key);

const { error, paymentIntent } = await stripe.confirmCardPayment(
  charge.next_action.client_secret,
  { payment_method: { card: cardElement, billing_details: { email } } }
);

if (paymentIntent?.status === "succeeded") {
  await fetch(`/api/verify-charge/${charge.id}`, { method: "POST" });
}
```

### Python (server) — initiate

```python
import requests
r = requests.post(
  "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-create-charge",
  headers={"Authorization": f"Bearer {SK_TEST}", "Idempotency-Key": "order_12345"},
  json={"amount": 10000, "currency": "XAF", "channel": "card",
        "customer_email": "jane@example.com", "tx_ref": "order_12345"},
).json()
return {"client_secret": r["next_action"]["client_secret"],
        "publishable_key": r["next_action"]["publishable_key"]}
```

### PHP

```php
$ch = curl_init("https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-create-charge");
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => ["Authorization: Bearer $SK_TEST", "Content-Type: application/json", "Idempotency-Key: order_12345"],
  CURLOPT_POSTFIELDS => json_encode(["amount" => 10000, "currency" => "XAF", "channel" => "card", "tx_ref" => "order_12345"]),
]);
$charge = json_decode(curl_exec($ch), true);
echo $charge["next_action"]["client_secret"];
```

### Java

```java
HttpRequest req = HttpRequest.newBuilder()
  .uri(URI.create("https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-create-charge"))
  .header("Authorization", "Bearer " + skTest)
  .header("Idempotency-Key", "order_12345")
  .POST(HttpRequest.BodyPublishers.ofString(
    "{\"amount\":10000,\"currency\":\"XAF\",\"channel\":\"card\",\"tx_ref\":\"order_12345\"}"))
  .build();
String body = HttpClient.newHttpClient().send(req, BodyHandlers.ofString()).body();
// parse body.next_action.client_secret
```

### Go

```go
body := strings.NewReader(`{"amount":10000,"currency":"XAF","channel":"card","tx_ref":"order_12345"}`)
req, _ := http.NewRequest("POST", "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-create-charge", body)
req.Header.Set("Authorization", "Bearer "+skTest)
req.Header.Set("Idempotency-Key", "order_12345")
res, _ := http.DefaultClient.Do(req)
// decode res.Body → take .next_action.client_secret
```

## Test cards (sandbox)

| Outcome | Card |
|---|---|
| Success (no 3DS) | `4242 4242 4242 4242` |
| 3DS required | `4000 0027 6000 3184` |
| Declined | `4000 0000 0000 9995` |

Any future expiry, any 3-digit CVC, any postcode.

## Common pitfalls

- **Do NOT** post raw card numbers to the KOB API — only Stripe.js may collect them.
- The publishable key is safe to expose. The `client_secret` is single-use and bound to one charge.
- After `stripe.confirmCardPayment` succeeds, **always** call `/v1/gateway/charges/{id}/verify` so KOB persists the terminal state and emits the `charge.successful` webhook.
