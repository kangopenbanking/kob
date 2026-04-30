# SDK Release v1.5.0 — Runbook

**Date:** 2026-04-30  
**Spec alignment:** OpenAPI v4.26.11  
**Trigger:** push tag `sdk-v1.5.0` to `main`

## What changed

| Package | Previous | New |
|---|---|---|
| `@kangopenbanking/sdk` (Node) | 1.4.0 | **1.5.0** |
| `kangopenbanking` (Python, pyproject) | 1.2.0 ⚠️ drift | **1.5.0** |
| `kangopenbanking.__version__` | 1.4.0 | **1.5.0** |
| `kangopenbanking/sdk` (PHP/Packagist) | 1.2.0 | **1.5.0** |
| `github.com/kangopenbanking/sdk-go` | untagged | **v1.5.0** |
| `sdks/generated/*` (typed) | 4.26.x | **4.26.11** |

## Spec deltas covered (slices 1–6)

- Slice 1 — additive operationId/tag normalization
- Slice 2 — error catalog patch (RFC 7807 codes)
- Slice 3 — DELETE idempotency-key support
- Slice 4 — governance files lint (CODEOWNERS, PR template, Guardian roster)
- Slice 5 — perf budget + deployed parity CI ratchets
- Slice 6 — `webhook_inbox` DLQ + retry worker + admin replay

## Publish steps (run from a workstation with push access)

```bash
git pull origin main
git tag sdk-v1.5.0
git push origin sdk-v1.5.0
```

This triggers `.github/workflows/publish-sdks.yml`, which fans out to:

| Job | Registry | Secret |
|---|---|---|
| `publish-npm` | npmjs.com | `NPM_TOKEN` |
| `publish-pypi` | pypi.org | `PYPI_API_TOKEN` |
| `publish-packagist` | GitHub Release → Packagist webhook | (none — uses `GITHUB_TOKEN`) |

The Go SDK is consumed directly via `go get github.com/kangopenbanking/sdk-go@v1.5.0` — the tag itself is the release.

## Verification

After workflow completion:

```bash
# Node
npm view @kangopenbanking/sdk version           # → 1.5.0

# Python
pip index versions kangopenbanking              # → 1.5.0 listed

# PHP
composer show kangopenbanking/sdk --all         # → 1.5.0 listed

# Go
go list -m github.com/kangopenbanking/sdk-go@v1.5.0
```

## Standing-order compliance

- **Order 6 (Version Gate):** Minor bump 1.4 → 1.5 for accumulated additive surface.
- **Order P5 (Working Code Rule):** CI `sdk-generate.yml` regenerates and compiles all four typed clients on every push.
- **Order 2 (Ratchet):** No SDK class, method, or type was removed — only added or regenerated.
