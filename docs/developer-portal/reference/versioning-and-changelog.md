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

### Current Version: 4.10.0

See [CHANGELOG.md](/CHANGELOG.md) for full release notes.

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
| Node.js | 1.1.0 | `@kangopenbanking/sdk` |
| Python | 1.1.0 | `kangopenbanking` |
| PHP | 1.1.0 | `kangopenbanking/sdk-php` |
