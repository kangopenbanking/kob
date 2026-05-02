# CHANGELOG v4.28.2 — Webhook Header Naming Alignment

**Release date:** 2026-05-02
**Type:** Patch (Standing Order 6 — Version Gate)
**Breaking changes:** None

## Summary

Documentation-only alignment of webhook signature and replay-protection
header names across the OpenAPI specification. Runtime verification middleware
already accepts all canonical headers and aliases listed below — this release
makes the contract explicit for integrators.

## What Changed

Added an explicit **"Webhook Signature & Replay Headers (canonical)"** table to
`info.description` in both `public/openapi.yaml` and `public/openapi.json`.

| Canonical Header     | Purpose                                                                      | Accepted Aliases                            |
|----------------------|------------------------------------------------------------------------------|---------------------------------------------|
| `X-KOB-Signature`    | HMAC-SHA256 hex digest of the raw body, format `v1=<hex>` (signature versioning) | `X-Kang-Signature`, `X-Webhook-Signature`   |
| `X-Webhook-ID`       | Unique event identifier (UUID v4); 24h dedup window                          | `Kang-Webhook-ID`                            |
| `X-Webhook-Timestamp`| RFC 3339 timestamp; receivers SHOULD reject events older than 5 minutes       | —                                            |
| `X-Webhook-Event`    | Event type, mirrors body `type`                                              | —                                            |
| `X-Webhook-Attempt`  | 1-based delivery attempt counter (1–7)                                       | —                                            |

## Standing Orders Compliance

- **SO 1 (The Lock):** No operationIds, paths, or schema names renamed.
- **SO 2 (The Ratchet):** Additive only — no required fields, enums, or response codes removed.
- **SO 3 (The Audit Trail):** Cites RFC 7230 §3.2 (case-insensitive headers), Stripe webhook signature versioning convention, and existing project memory `Webhook Governance and Security`.
- **SO 4 (The Surgeon Rule):** Pure addition to `info.description` markdown.
- **SO 5 (Dead Code Rule):** N/A — no new components.
- **SO 6 (Version Gate):** Patch bump 4.28.1 → 4.28.2 (non-breaking documentation enhancement).
- **SO 7 (Five Roles):** Guardian, Architect, Surgeon, Auditor, Scorekeeper — all reinstated for this edit.

## Files Changed

- `public/openapi.yaml` — version bump + headers table
- `public/openapi.json` — version bump + headers table
- `public/changelog.json` — release entry
- `CHANGELOG.md` + `public/CHANGELOG.md` — rebuilt index
- `docs/governance/CHANGELOG-v4.28.2.md` — this file
