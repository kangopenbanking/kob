# Versioning & Changelog

## API Versioning

KOB uses URL-based versioning. The current production version is **v1**.

```
https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway/charges
```

### Version Lifecycle

| Phase | Duration | Behavior |
|-------|----------|----------|
| **Active** | Current | Full support, new features added |
| **Deprecated** | 6 months notice | `Deprecation` and `Sunset` headers added to responses |
| **Sunset** | After sunset date | Returns `410 Gone` |

### Deprecation Headers

When an endpoint is deprecated, responses include:

```http
Deprecation: true
Sunset: Sat, 01 Jan 2028 00:00:00 GMT
Link: <https://kangopenbanking.com/developer/migration-guide>; rel="successor-version"
```

## Changelog

The full changelog is available at:
- **Markdown**: [`/CHANGELOG.md`](https://github.com/kangopenbanking/kob/blob/main/CHANGELOG.md)
- **Machine-readable**: [`/changelog.json`](https://kangopenbanking.com/changelog.json)

### Current Version: 4.29.2

Recent releases:

| Version | Date | Summary |
|---------|------|---------|
| 4.29.2 | 2026-05-04 | Version alignment across OpenAPI, Postman, guide metadata, and changelog mirrors |
| 4.29.1 | 2026-05-03 | Critical live-spec remediation for PISP payment submission and retired endpoints |
| 4.29.0 | 2026-05-03 | Audit remediation across PISP, retired endpoints, monetary fields, webhooks, SDK metadata, and pagination |
| 4.28.2 | 2026-05-02 | Webhook signature and replay-protection header naming alignment |
| 4.28.1 | 2026-05-02 | SDK coverage metadata and real-world examples route verification |
| 4.28.0 | 2026-05-02 | Spec versioning, diff endpoints, provider simulators, and webhook replay tooling |
| 4.27.3 | 2026-05-02 | OpenAPI regression hardening for webhooks, tags, responses, and FAPI headers |
| 4.27.2 | 2026-05-02 | Response examples, multi-language code samples, and webhook catalogue expansion |
| 4.27.1 | 2026-05-02 | Standards discoverability and public proof pages |
| 4.27.0 | 2026-05-01 | FAPI, OBIE, Berlin Group, FDX, ISO 20022, PSD2, and COBAC alignment |
| 4.26.7 | 2026-04-30 | Phase 6 production-readiness closeout |
| 4.26.x | 2026-04-30 | Payment gateway, documentation, contract, Postman, SDK, and E2E readiness phases |
| 4.25.0 | 2026-04-30 | File-based Bank Connector Kit |
| 4.24.0 | 2026-04-30 | Open Banking readiness aliases and AISP pagination parity |
| 4.23.0 | 2026-04-30 | Per-phase changelog backfill and versioning policy reaffirmation |
| 4.22.0 | 2026-04-29 | End-to-end CI gate and dashboard route coverage |
| 4.21.0 | 2026-04-28 | Runtime and spec hardening |
| 4.20.0 | 2026-04-27 | Idempotency hardening across financial mutation endpoints |
| 4.19.0 | 2026-04-26 | CSV export endpoints |
| 4.18.0 | 2026-04-25 | Outbound webhook reliability |
| 4.17.0 | 2026-04-22 | KOB Integration Layer — Stripe-style facade over `/v1/*` (additive) |
| 4.16.4 | 2026-04-21 | Security Posture Self-Verification Layer (`/healthz`, hardened `/oidc-config`) |
| 4.15.0 | 2026-04-17 | CEMAC Universal Bank Integration — Wave 4: architecture overview & docs |
| 4.14.0 | 2026-04-17 | Wave 3: ledger audit fields + six-stage bank onboarding wizard |
| 4.13.0 | 2026-04-17 | Wave 2: scheduled bank polling engine + rule-based reconciliation |
| 4.12.0 | 2026-04-17 | Wave 1: unified BankConnector interface (REST/SQL/File/SOAP) |
| 4.11.0 | 2026-04-17 | BYO Phase 2: server-side polling + SOAP Bank adapter |
| 4.10.0 | 2026-04-17 | BYO Mobile Money Connectors (MTN MoMo, Orange Money) |
| 4.9.7  | 2026-04-14 | Direct Backend Infrastructure standardization |

See [CHANGELOG.md](/CHANGELOG.md) for full release notes and [`/changelog.json`](https://kangopenbanking.com/changelog.json) for the machine-readable feed.

## Backward Compatibility Promise

KOB follows a strict **zero breaking changes** policy for v1:

1. **No field removal** — existing response fields are never removed
2. **No type changes** — field types remain stable
3. **Additive only** — new fields, endpoints, and events may be added
4. **Webhook events** — new event types may be introduced; handlers should ignore unknown types
5. **Error codes** — new error codes may be added; clients should handle unknown codes gracefully

## SDK Versioning

| SDK | Current Version | Package |
|-----|----------------|---------|
| Node.js | 1.3.0 | `@kangopenbanking/sdk` |
| Python | 1.1.0 | `kangopenbanking` |
| PHP | 1.1.0 | `kangopenbanking/sdk-php` |
