# CHANGELOG — v4.51.5

**Release date**: 2026-06-25
**Type**: patch · **Breaking changes**: none
**Phase**: 5 — Consistency & Hygiene (Compliance Remediation Series — final)

## Summary

Spec-wide consistency pass. Every operation response in the production and sandbox OpenAPI specs now advertises rate-limit headers, and every `429` response advertises `Retry-After`. Money-amount schemas were audited against the canonical zero-decimal pattern — no regressions.

## Highlights

- `X-RateLimit-Limit / X-RateLimit-Remaining / X-RateLimit-Reset` added to **7,744** responses (3,852 header refs).
- `Retry-After` added to **50** `429` responses.
- Money-amount audit: all amount-typed string fields keep `^[0-9]{1,15}$` (zero-decimal currency safety preserved).
- Idempotent: `node scripts/phase5-consistency-hygiene.mjs` re-runs as a no-op.

## Standards cited

- IETF `draft-ietf-httpapi-ratelimit-headers`
- RFC 7231 §7.1.3 (`Retry-After`)
- Guardian Standing Orders 1, 2, 4, 6

## Files

- `scripts/phase5-consistency-hygiene.mjs`
- `PHASE_5_CONSISTENCY_HYGIENE_CLOSEOUT.md`
- `public/openapi.json`, `public/openapi.yaml`
- `public/openapi-sandbox.json`, `public/openapi-sandbox.yaml`
- `public/changelog.json`, `public/CHANGELOG.md`
- `src/config/version.ts`
- `public/postman/*` (v4.51.5 collection + manifest)
