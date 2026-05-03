# Fix Netlify deploy deadlock for v4.29.1

## Problem

Netlify's production build runs `npm run predeploy`, which audits the **already-live** site at `https://kangopenbanking.com`. That site still serves v4.28.2 (because this very build is what would publish v4.29.1). The audit therefore fails with `spec-version:4.28.2` and `changelog-version:4.28.2`, blocking the deploy that would fix the mismatch. Classic chicken-and-egg.

The repo is correct (v4.29.1) — version-parity check passes. Only the post-publish live audit fails.

## Recommended fix (non-breaking, preserves all guardrails)

Switch Netlify's **production** context to use `predeploy:offline` instead of `predeploy`. This keeps the strict version-parity gate (openapi.json + changelog.json must match `src/config/version.ts`) but skips the self-referential live audit during the build itself.

Post-deploy live verification is already covered by:
- `.github/workflows/developer-portal-deep-audit.yml` (runs every 15 min against the live host, opens an issue + Slack on failure)
- `.github/workflows/developer-portal-uptime.yml` and `developer-portal-smoke.yml`

So we lose nothing — we just stop asking the build to verify its own not-yet-published output.

## Change

Edit `netlify.toml`, `[context.production]` block only:

```toml
[context.production]
  command = "export EXPECTED_OPENAPI_VERSION=$(node scripts/print-expected-version.mjs) && npm run predeploy:offline && npm run build"
```

Leave `[context.deploy-preview]` and `[context.branch-deploy]` unchanged (they already use `predeploy:offline`). Leave the top-level `[build]` command unchanged so local `netlify build` without a context still runs the full audit.

## Why not the alternative (revert to 4.28.2)

The audit guidance suggests rolling the repo back to 4.28.2. We reject that — v4.29.1 is the SSOT in `src/config/version.ts`, the OpenAPI spec, changelog, SDKs (1.6.0), and Postman collection are all already cut for 4.29.1, and Standing Order 2 (Ratchet) forbids moving compliance/version state backwards.

## Post-deploy verification

After the deploy succeeds:
1. The 15-min `developer-portal-deep-audit` workflow will hit the live host and confirm `/openapi.json` and `/changelog.json` now report `4.29.1`.
2. We can manually re-run `node scripts/audit-public-access.mjs https://kangopenbanking.com` from CI or locally to confirm 20/20 PASS.

## Files touched

- `netlify.toml` (one-line change to the `[context.production]` command)

No code, no spec, no SDK, no migration changes.
