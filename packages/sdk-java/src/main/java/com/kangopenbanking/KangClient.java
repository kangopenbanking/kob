package com.kangopenbanking;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Kang Open Banking — minimal Java client.
 *
 * Standing Order P5 (Working Code Rule) — must compile clean on Java 11+
 * with no external runtime dependencies and operate against the public
 * sandbox using credentials published at /developer/sandbox/credentials.
 */
public class KangClient {

    private static final int MAX_RETRIES = 3;
    private static final Duration TIMEOUT = Duration.ofSeconds(30);
    private static final long WEBHOOK_TOLERANCE_SECONDS = 300L;

    private final String baseUrl;
    private final String apiKey;
    private final HttpClient http;

    public KangClient(String baseUrl, String apiKey) {
        this.baseUrl = stripTrailingSlash(baseUrl);
        this.apiKey = apiKey;
        this.http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
    }

    /** GET request returning raw JSON body. */
    public String get(String path, Map<String, String> extraHeaders) throws Exception {
        return execute("GET", path, null, extraHeaders);
    }

    /** POST request with JSON body. Body is encoded as a simple flat JSON object. */
    public String post(String path, Map<String, String> body, Map<String, String> extraHeaders) throws Exception {
        return execute("POST", path, encodeJson(body), extraHeaders);
    }

    private String execute(String method, String path, String body, Map<String, String> extraHeaders) throws Exception {
        String traceId = UUID.randomUUID().toString();
        Exception last = null;

        for (int attempt = 0; attempt < MAX_RETRIES; attempt++) {
            HttpRequest.Builder b = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + path))
                .timeout(TIMEOUT)
                .header("Authorization", "Bearer " + apiKey)
                .header("Accept", "application/json")
                .header("X-Trace-Id", traceId)
                .header("X-Request-ID", UUID.randomUUID().toString())
                .header("User-Agent", "kangopenbanking-java/4.40.0");

            if (body != null) {
                b.header("Content-Type", "application/json");
            }

            if (extraHeaders != null) {
                for (Map.Entry<String, String> e : extraHeaders.entrySet()) {
                    b.header(e.getKey(), e.getValue());
                }
            }

            HttpRequest.BodyPublisher bp = body == null
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8);

            HttpRequest req = b.method(method, bp).build();

            try {
                HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
                int sc = resp.statusCode();

                if (sc >= 200 && sc < 300) {
                    return resp.body();
                }

                // Retry on 429 / 5xx with Retry-After honoring
                if (sc == 429 || sc >= 500) {
                    long sleep = parseRetryAfter(resp).orElse((long) Math.pow(2, attempt) * 1000L);
                    Thread.sleep(sleep);
                    continue;
                }

                throw new KangApiException(sc, resp.body());
            } catch (java.io.IOException | InterruptedException ex) {
                last = ex;
                Thread.sleep((long) Math.pow(2, attempt) * 1000L);
            }
        }
        throw new KangApiException(0, last == null ? "exhausted retries" : last.getMessage());
    }

    /** Verify a Kang webhook signature (HMAC-SHA256, 5-minute window). */
    public boolean verifyWebhook(String signatureHeader, String timestampHeader, String secret, String rawBody) {
        try {
            long ts = Long.parseLong(timestampHeader);
            long now = Instant.now().getEpochSecond();
            if (Math.abs(now - ts) > WEBHOOK_TOLERANCE_SECONDS) return false;

            String payload = timestampHeader + "." + rawBody;
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] computed = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return constantTimeEquals(hex(computed), signatureHeader);
        } catch (Exception e) {
            return false;
        }
    }

    // ---- helpers -----------------------------------------------------------

    private static java.util.Optional<Long> parseRetryAfter(HttpResponse<?> resp) {
        return resp.headers().firstValue("Retry-After").map(v -> {
            try { return Long.parseLong(v.trim()) * 1000L; } catch (Exception e) { return null; }
        });
    }

    private static String stripTrailingSlash(String s) {
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }

    private static String encodeJson(Map<String, String> body) {
        if (body == null) return "{}";
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, String> e : body.entrySet()) {
            if (!first) sb.append(',');
            sb.append('"').append(escape(e.getKey())).append("\":\"").append(escape(e.getValue())).append('"');
            first = false;
        }
        return sb.append('}').toString();
    }

    private static String escape(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static String hex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    private static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null || a.length() != b.length()) return false;
        try {
            return MessageDigest.isEqual(
                a.getBytes(StandardCharsets.UTF_8),
                b.getBytes(StandardCharsets.UTF_8)
            );
        } catch (Exception e) {
            return false;
        }
    }

    public static class KangApiException extends RuntimeException {
        public final int statusCode;
        public KangApiException(int statusCode, String message) {
            super("Kang API error " + statusCode + ": " + message);
            this.statusCode = statusCode;
        }
    }
}
