# Kang Open Banking — Java SDK

Skeleton package satisfying Docs Standing Order P9 (Multi-Language Rule).

Java 11+, Maven, OkHttp + Gson. Auto-generated typed clients are produced by
`scripts/generate-typed-sdks.mjs` into `sdks/generated/java/`. This `packages/sdk-java`
package is the **hand-tuned** wrapper with idiomatic helpers (OAuth2 client-credentials
bootstrap, `Idempotency-Key` injection, HMAC-SHA256 webhook verification with 5-minute
clock window, exponential-backoff retry honouring `Retry-After`).

## Install (Maven)

```xml
<dependency>
  <groupId>com.kangopenbanking</groupId>
  <artifactId>kangopenbanking-sdk</artifactId>
  <version>4.40.0</version>
</dependency>
```

## Quickstart

```java
KangClient kob = KangClient.builder()
    .clientId(System.getenv("KANG_CLIENT_ID"))
    .clientSecret(System.getenv("KANG_CLIENT_SECRET"))
    .environment(Environment.SANDBOX)
    .build();

Charge charge = kob.gateway().charges().create(
    ChargeRequest.builder()
        .amount("50000").currency("XAF").channel("mobile_money")
        .customerPhone("+237670000000").txRef(UUID.randomUUID().toString())
        .build(),
    UUID.randomUUID().toString()  // Idempotency-Key
);
```

See the [public docs](https://kangopenbanking.com/developer) for the full Java guide.

> **Status:** Skeleton. Implementation tracks `public/openapi.json` v4.40.0 and ships
> alongside the auto-generated typed client. Open an issue to influence the public API.
