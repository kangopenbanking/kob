# Phase 1B-R1I-c.4 — Server-URL Exception (Pre-existing, Carry-forward)

## Failures

Two failures in `src/test/openapi-diff.test.ts`:

| Test | Exact assertion | Failure message |
| --- | --- | --- |
| `OpenAPI spec-diff against previous release baseline > production — server base URL still resolves to https://api.kangopenbanking.com/v1` | `expect(urls.some((u) => u.startsWith('https://api.kangopenbanking.com/v1'))).toBe(true)` | `AssertionError: expected false to be true` |
| `OpenAPI spec-diff against previous release baseline > sandbox — server base URL still resolves to https://api.kangopenbanking.com/v1` | Same predicate against `public/openapi-sandbox.json` | Same |

## Root cause

`public/openapi.json` and `public/openapi-sandbox.json` declare:

```json
"servers": [
  {"url": "https://api.kangopenbanking.com", "description": "Production"},
  {"url": "https://sandbox-api.kangopenbanking.com", "description": "Sandbox"}
]
```

Neither URL carries the `/v1` suffix that the diff test's `expectedBase` requires. The suffix is instead applied at the path level (`/v1/...` in every operation). The test's `startsWith` predicate therefore returns `false` on every current entry.

## Pre-existing proof

| Control | Pre-c.4 | Post-c.4 | c.4-attributable? |
| --- | --- | --- | --- |
| Failing test names | Both above | Both above | No — identical |
| Failure count | 2 | 2 | No |
| Failure signature | `expected false to be true` at `openapi-diff.test.ts:69` | Same | No |
| `servers[]` contents in current spec | 2 entries, no `/v1` | 2 entries, no `/v1` | No — c.4 did not touch `servers[]` |
| `expectedBase` literal in test | `https://api.kangopenbanking.com/v1` | `https://api.kangopenbanking.com/v1` | No — c.4 did not modify the diff test |
| Baseline (`public/docs/baselines/openapi.previous.json`) version | 4.17.0 | 4.17.0 | No |

The c.4 patch diff, restricted to:

- `public/openapi.json` (removed one entry in `paths`);
- `public/openapi.yaml` (regenerated from JSON);
- `public/changelog.json`, `CHANGELOG.md`, `public/CHANGELOG.md`;
- 5 vitest files (assertion literals only);
- `docs/audits/phase-1/*`;
- `scripts/slice-c4-remove-budgeting-delete-rule.mjs`;

does **not** touch `servers[]`, `info`, `externalDocs`, or the diff test. The failure surface is therefore unchanged.

## Disposition under c.4V

Per slice authorisation this failure MUST NOT be:

- treated as passing;
- added to the four authorised UI-flake rotations;
- suppressed;
- removed from the suite;
- fixed under this verification slice.

**Carry-forward finding — resolution required before release.**

## Recommended resolution (out of c.4V scope)

Two viable paths, either handled under a separate contract-correction gate:

1. **Adjust `servers[]`** so the base URL includes `/v1`, and rebase every path from `/v1/...` to `/...`. Requires: full version increment (breaking change), regenerated SDKs, refreshed Postman collections, all API clients updated.
2. **Adjust the test's `expectedBase`** to `https://api.kangopenbanking.com` (strip the `/v1` suffix) and separately assert that every path key begins with `/v1/`. Non-breaking; contract truthfulness restored without a version bump.

Option 2 is the lower-risk correction and aligns with the actual contract convention (path-scoped versioning). Decision reserved for the pre-release gate.

## Tracking

- Owner: API Guardian
- Gate: Pre-release contract-correction slice (not yet opened)
- Blocks: release cut of 4.53.1
- Does not block: c.4 closure (per slice brief §2)
