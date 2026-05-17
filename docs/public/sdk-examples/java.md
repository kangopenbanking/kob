# Java SDK Integration Guide

Complete integration guide for the official **Kang Open Banking Java SDK**
(`com.kangopenbanking:kangopenbanking-sdk:4.40.0`).

- Targets **Java 11+**
- **Zero runtime dependencies** — uses `java.net.http.HttpClient` from the JDK
- Works against the public sandbox with the credentials published at
  [`/developer/sandbox/credentials`](https://kangopenbanking.com/developer/sandbox/credentials)

---

## 1. Install (Maven)

Add the dependency to your `pom.xml`:

```xml
<dependency>
  <groupId>com.kangopenbanking</groupId>
  <artifactId>kangopenbanking-sdk</artifactId>
  <version>4.40.0</version>
</dependency>
```

Or with **Gradle (Kotlin DSL)**:

```kotlin
implementation("com.kangopenbanking:kangopenbanking-sdk:4.40.0")
```

> The SDK is published as a single artifact with no transitive dependencies.
> If you also pull in Jackson, Gson, or any HTTP library, that is your
> application's choice — the SDK does not require them.

---

## 2. Configuration

| Item | Sandbox | Production |
|---|---|---|
| Base URL | `https://sandbox-api.kangopenbanking.com/v1` | `https://api.kangopenbanking.com/v1` |
| Secret key prefix | `sk_test_…` / `sbx_…` | `sk_live_…` |
| Auth header | `Authorization: Bearer <key>` | `Authorization: Bearer <key>` |

Inject the base URL and key from environment variables — **never hardcode
secrets**:

```java
String baseUrl = System.getenv().getOrDefault(
    "KOB_BASE_URL", "https://sandbox-api.kangopenbanking.com/v1");
String apiKey = System.getenv("KOB_API_KEY");
KangClient client = new KangClient(baseUrl, apiKey);
```

For OAuth2 client-credentials flows, exchange `client_id` / `client_secret`
at `/oauth2/token` and pass the resulting `access_token` to `KangClient`.

---

## 3. Quick start — create a charge

```java
import com.kangopenbanking.KangClient;
import java.util.Map;
import java.util.UUID;

public class Quickstart {
    public static void main(String[] args) throws Exception {
        var client = new KangClient(
            "https://sandbox-api.kangopenbanking.com/v1",
            System.getenv("KOB_API_KEY")
        );

        String idempotencyKey = UUID.randomUUID().toString();

        String json = client.post(
            "/charges",
            Map.of(
                "amount",         "5000",                // XAF is zero-decimal — pass string
                "currency",       "XAF",
                "channel",        "mobile_money",
                "customer_phone", "237650000000",
                "tx_ref",         "order_001"
            ),
            Map.of("Idempotency-Key", idempotencyKey)
        );

        System.out.println(json);
    }
}
```

### Successful response (truncated)

```json
{
  "id": "ch_01HNZ...",
  "status": "successful",
  "amount": "5000",
  "currency": "XAF",
  "channel": "mobile_money",
  "tx_ref": "order_001",
  "created_at": "2026-05-17T20:41:00Z"
}
```

Sandbox test phone numbers, cards, and reset semantics are documented at
[`/developer/sandbox/credentials`](https://kangopenbanking.com/developer/sandbox/credentials).

---

## 4. Retry & idempotency behavior

The SDK enforces the same retry envelope as the rest of the platform.

### 4.1 Built-in retry policy

| Trigger | Behavior |
|---|---|
| HTTP `429 Too Many Requests` | Respects `Retry-After` header (seconds). If absent, exponential backoff `2^attempt × 1s`. |
| HTTP `5xx` | Same as `429` — exponential backoff with `Retry-After` honoring. |
| `IOException` / `InterruptedException` | Retried with exponential backoff. |
| Maximum attempts | **3** total (1 initial + 2 retries). |
| Request timeout | **30 seconds** per attempt. |

After the final attempt the SDK throws `KangClient.KangApiException` with
the upstream status code and response body.

### 4.2 Idempotency keys (mandatory for writes)

Every write (`POST /charges`, `/refunds`, `/payouts`, `/transfers`, etc.)
**must** include an `Idempotency-Key` header. The platform stores the first
result for **24 hours** and replays it for any subsequent request with the
same key — even across retries, restarts, and network failures.

```java
String key = UUID.randomUUID().toString(); // RFC 4122 v4 — required format

// First call — executes the charge
String first = client.post("/charges", body, Map.of("Idempotency-Key", key));

// Replay within 24h — returns the exact same response, no duplicate charge
String replay = client.post("/charges", body, Map.of("Idempotency-Key", key));

assert first.equals(replay);
```

**Rules** (matches `mem://idempotency` core memory):
- Keys must be UUID v4. Other formats are rejected with `400 idempotency_key_invalid`.
- A second request with the **same key but a different body** is rejected with
  `409 idempotency_key_reused`.
- Replays return the same HTTP status, body, and `X-Replayed: true` header.

### 4.3 Distributed tracing

Every request automatically carries:

- `X-Request-ID` — fresh UUID v4 per attempt (echoed in the response).
- `X-Trace-Id` — stable for the lifetime of the operation, including retries.
  Honors inbound `traceparent` (W3C Trace Context) if you pre-set it in
  `extraHeaders`.

Log both values alongside your application logs so support can correlate end
to end in the `/admin/slo` dashboard.

---

## 5. Webhook signature verification

Kang webhooks are signed with **HMAC-SHA256** over the payload `timestamp + "." + rawBody`
and delivered with these headers:

| Header | Meaning |
|---|---|
| `X-KOB-Signature` | Hex-encoded HMAC-SHA256 digest. |
| `X-KOB-Timestamp` | Unix epoch seconds when the event was signed. |
| `X-KOB-Event-Id` | Stable event identifier — use for deduplication. |

The SDK ships a verifier with a built-in **5-minute replay window** and
constant-time comparison:

```java
import com.kangopenbanking.KangClient;

public class WebhookHandler {

    private static final String SECRET = System.getenv("KOB_WEBHOOK_SECRET");
    private final KangClient client = new KangClient("unused", "unused");

    /** Spring / Jakarta endpoint — example signature is framework-agnostic. */
    public int handle(String rawBody, String signatureHeader, String timestampHeader, String eventId) {
        boolean ok = client.verifyWebhook(signatureHeader, timestampHeader, SECRET, rawBody);
        if (!ok) {
            return 401; // Invalid signature OR outside 5-minute window
        }

        if (alreadyProcessed(eventId)) {
            return 200; // Idempotent — Kang will retry on any non-2xx response
        }

        // Process the event, then mark it processed atomically.
        process(rawBody);
        markProcessed(eventId);
        return 200;
    }

    // Replace with your persistent store (DB / Redis / etc.)
    private boolean alreadyProcessed(String id) { /* ... */ return false; }
    private void markProcessed(String id)      { /* ... */ }
    private void process(String body)          { /* ... */ }
}
```

### Critical rules

1. **Always verify against the raw body** — do not parse-then-reserialize.
   Re-serialized JSON changes byte ordering and the signature will fail.
2. **Deduplicate by `X-KOB-Event-Id`** — Kang retries up to **7 times**
   with exponential backoff on any non-`2xx` response (see
   [Webhook Governance](https://kangopenbanking.com/developer/webhooks)).
3. **Respond within 10 seconds** — slower handlers count as failures and
   trigger retries.
4. **Return 2xx as soon as the event is durably stored.** Do the heavy work
   asynchronously.

---

## 6. Error handling

`KangClient.KangApiException` exposes:

| Field | Description |
|---|---|
| `statusCode` | HTTP status from the upstream response. |
| `getMessage()` | `"Kang API error <status>: <body>"` — body is RFC 7807 problem+json. |

```java
try {
    String json = client.post("/charges", body, Map.of("Idempotency-Key", key));
} catch (KangClient.KangApiException e) {
    switch (e.statusCode) {
        case 400 -> log.warn("Validation error: {}", e.getMessage());
        case 401 -> log.error("Invalid API key");
        case 402 -> log.info("Charge declined by issuer/operator");
        case 409 -> log.warn("Idempotency conflict — body changed for same key");
        case 429 -> log.warn("Rate-limited despite SDK backoff — slow down");
        default  -> log.error("Upstream {} — {}", e.statusCode, e.getMessage());
    }
}
```

The full error catalog (63 RFC 7807 codes) is published in the OpenAPI
`x-error-catalog` extension and at
[`/developer/api/error-codes`](https://kangopenbanking.com/developer/api/error-codes).

---

## 7. Common operations

```java
// Retrieve a charge
String charge = client.get("/charges/ch_01HNZ...", Map.of());

// Refund (partial supported — amount is optional)
String refund = client.post(
    "/refunds",
    Map.of("charge_id", "ch_01HNZ...", "amount", "2000", "reason", "customer_request"),
    Map.of("Idempotency-Key", UUID.randomUUID().toString())
);

// Payout to a bank account
String payout = client.post(
    "/payouts",
    Map.of(
        "amount",       "100000",
        "currency",     "XAF",
        "account_number", "10001234567890",
        "bank_code",      "10005",
        "narration",      "Supplier settlement"
    ),
    Map.of("Idempotency-Key", UUID.randomUUID().toString())
);
```

---

## 8. Production checklist

- [ ] Inject `KOB_API_KEY` and `KOB_WEBHOOK_SECRET` via your secret manager, not env files in source control.
- [ ] Use `sk_live_…` keys only after KYB approval.
- [ ] Log `X-Request-ID` and `X-Trace-Id` on every outbound call.
- [ ] Persist `X-KOB-Event-Id` in a unique index for webhook deduplication.
- [ ] Configure your reverse proxy / WAF to forward the raw webhook body unmodified.
- [ ] Set application-level circuit breakers around `KangClient` (the SDK
      handles transient retries but not long upstream outages).
- [ ] Monitor your error rates against the published SLOs:
      **charges ≥ 99.5% success, p95 < 1500ms** — see `/admin/slo`.

---

## 9. Reference

- [OpenAPI specification (JSON)](https://kangopenbanking.com/openapi.json) — `info.version 4.40.0`
- [OpenAPI specification (YAML)](https://kangopenbanking.com/openapi.yaml)
- [Postman collection (v4.40.0)](https://kangopenbanking.com/postman/Kang_Open_Banking_API_v4.40.0.postman_collection.json)
- [Source code](https://github.com/kangopenbanking) — `packages/sdk-java`
- [Changelog](https://kangopenbanking.com/developer/changelog)

For language-equivalent guides see
[`typescript.md`](./typescript.md), [`python.md`](./python.md), and
[`php.md`](./php.md).
