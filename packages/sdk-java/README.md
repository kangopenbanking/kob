# Kang Open Banking — Java SDK

Official thin Java client for the Kang Open Banking REST API (v4.40.0+).

Targets **Java 11+** and uses only the standard library (`java.net.http.HttpClient`) — no external runtime dependencies.

## Install (Maven)

```xml
<dependency>
  <groupId>com.kangopenbanking</groupId>
  <artifactId>kangopenbanking-sdk</artifactId>
  <version>4.40.0</version>
</dependency>
```

## Quick start

```java
import com.kangopenbanking.KangClient;
import java.util.Map;

var client = new KangClient(
    "https://sandbox-api.kangopenbanking.com/v1",
    "sk_test_xxx"
);

var charge = client.post(
    "/charges",
    Map.of(
        "amount", "5000",
        "currency", "XAF",
        "channel", "mobile_money",
        "customer_phone", "237650000000",
        "tx_ref", "order_001"
    ),
    Map.of("Idempotency-Key", java.util.UUID.randomUUID().toString())
);
System.out.println(charge);
```

## Features

- Bearer-token auth (publishable + secret keys, plus OAuth2 access tokens)
- Automatic `Idempotency-Key`, `X-Request-ID`, and `X-Trace-Id` propagation
- W3C `traceparent` support for distributed tracing
- Exponential backoff with `Retry-After` on `429` / `5xx`
- Webhook signature verification (HMAC-SHA256, 5-minute window)

## Standards

This SDK enforces the same headers and contracts as the cURL / Node / Python examples in [`/docs/public/sdk-examples`](../../docs/public/sdk-examples/). See `/developer` for the full spec.
