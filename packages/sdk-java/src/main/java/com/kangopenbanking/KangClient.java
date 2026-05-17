package com.kangopenbanking;

/**
 * Kang Open Banking — Java SDK skeleton (Phase 8 / v4.40.0).
 *
 * Hand-tuned helpers will live here. The auto-generated typed client is produced
 * separately into sdks/generated/java/ by scripts/generate-typed-sdks.mjs.
 *
 * This skeleton intentionally compiles standalone so downstream Maven consumers
 * can pin the artifact today and pick up implementations in subsequent minor
 * releases without re-pinning.
 */
public final class KangClient {
    public enum Environment { SANDBOX, PRODUCTION }

    private final String clientId;
    private final String clientSecret;
    private final Environment env;

    private KangClient(Builder b) {
        this.clientId = b.clientId;
        this.clientSecret = b.clientSecret;
        this.env = b.env;
    }

    public String baseUrl() {
        return env == Environment.PRODUCTION
            ? "https://api.kangopenbanking.com/v1"
            : "https://sandbox-api.kangopenbanking.com/v1";
    }

    public static Builder builder() { return new Builder(); }

    public static final class Builder {
        private String clientId;
        private String clientSecret;
        private Environment env = Environment.SANDBOX;
        public Builder clientId(String v) { this.clientId = v; return this; }
        public Builder clientSecret(String v) { this.clientSecret = v; return this; }
        public Builder environment(Environment v) { this.env = v; return this; }
        public KangClient build() { return new KangClient(this); }
    }
}
