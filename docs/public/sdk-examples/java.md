# Java

```xml
<dependency>
  <groupId>com.kangopenbanking</groupId>
  <artifactId>sdk</artifactId>
  <version>4.28.1</version>
</dependency>
```

## Initialise

```java
KOBClient kob = KOBClient.builder()
    .clientId(System.getenv("KANG_CLIENT_ID"))
    .clientSecret(System.getenv("KANG_CLIENT_SECRET"))
    .environment(Environment.SANDBOX)
    .build();
```

## Create a charge

```java
Charge c = kob.gateway().charges().create(
    ChargeRequest.builder()
        .amount(50000L)
        .currency("XAF")
        .channel("mobile_money")
        .customerPhone("+237670000000")
        .txRef(UUID.randomUUID().toString())
        .build(),
    RequestOptions.builder().idempotencyKey(UUID.randomUUID().toString()).build()
);
```

## Retry with exponential backoff

```java
<T> T withRetry(Supplier<T> fn) {
    for (int i = 0; i < 5; i++) {
        try { return fn.get(); }
        catch (KOBException e) {
            if (!Set.of(429, 500, 502, 503, 504).contains(e.status()) || i == 4) throw e;
            try { Thread.sleep(e.retryAfterMs().orElse((long) Math.pow(2, i) * 1000)); }
            catch (InterruptedException ie) { Thread.currentThread().interrupt(); throw e; }
        }
    }
    throw new IllegalStateException();
}
```

## Verify a webhook (Spring)

```java
@PostMapping("/webhooks/kob")
public ResponseEntity<Void> handle(@RequestHeader("X-Webhook-Signature") String sig,
                                   @RequestHeader("X-Webhook-Timestamp") String ts,
                                   @RequestBody String body) throws Exception {
    if (Math.abs(Instant.now().getEpochSecond() - Long.parseLong(ts)) > 300)
        return ResponseEntity.badRequest().build();
    Mac mac = Mac.getInstance("HmacSHA256");
    mac.init(new SecretKeySpec(secret.getBytes(), "HmacSHA256"));
    String expected = HexFormat.of().formatHex(mac.doFinal((ts + "." + body).getBytes()));
    return MessageDigest.isEqual(expected.getBytes(), sig.getBytes())
        ? ResponseEntity.ok().build() : ResponseEntity.status(401).build();
}
```
