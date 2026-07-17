# Phase 1B-R1I-c.4 — SDK / Postman Drift Assessment

**Assessment mode:** Read-only. No publication, no regeneration committed. Recorded for release gate.

## Method

- Grep every SDK source tree, Postman collection, and public catalogue artifact for `budgetingDeleteRule`, `deleteRule`, `DeleteRule`, and the removed path `/v1/budgeting/categories/rules/{ruleId}` (case-insensitive).
- Grep every SDK source tree for hard-coded `484` operation count.
- Cross-reference each hit against c.4's contract change.

## Findings

### Live spec surface — clean

| Artifact | `budgetingDeleteRule` | `/v1/budgeting/categories/rules/{ruleId}` | Action |
| --- | --- | --- | --- |
| `public/openapi.json` | 0 hits | 0 hits | — |
| `public/openapi.yaml` | 0 hits | 0 hits | — |
| `public/openapi-sandbox.json` | 0 hits | 0 hits | — |
| `public/apis.json`, `public/apis-sandbox.json` | 0 hits | 0 hits | — |

### Historical snapshots — untouched (historical fidelity preserved)

| Artifact | Retains removed op? | Reason |
| --- | --- | --- |
| `public/postman/Kang_Open_Banking_API_v4.51.5.postman_collection.json` | Yes | Historical release — do not mutate |
| `public/postman/Kang_Open_Banking_API_v4.52.0.postman_collection.json` | Yes | Historical release — do not mutate |
| `public/postman/Kang_Open_Banking_API_v4.52.1.postman_collection.json` | Yes | Historical release — do not mutate |
| `public/postman/Kang_Open_Banking_API_v4.53.0.postman_collection.json` | Yes | Historical release — do not mutate |
| `public/postman/Kang_Open_Banking_API_v1.postman_collection.json` | N/A | Legacy shape; no rule endpoint |

### Unreleased 4.53.1 postman — drift confirmed

| Artifact | Contains removed op? | Publication status | Required action |
| --- | --- | --- | --- |
| `public/postman/Kang_Open_Banking_API_v4.53.1.postman_collection.json` | Yes (1 request: `Delete rule` under `Budgeting > Categories > Rules`) | Unreleased | Regenerate before release |
| `public/postman/Kang_Open_Banking_API_latest.postman_collection.json` | Yes (identical alias) | Unreleased | Regenerate before release |

**These collections are pre-c.4 generation artifacts.** They inherited the removed operation because they were built while `budgetingDeleteRule` still existed in `public/openapi.json`. c.4V does **not** regenerate them because:

1. Publication is prohibited under the slice brief.
2. Regeneration would generate deltas outside the c.4V verification envelope.
3. The release-gate procedure already includes automatic Postman rebuild.

Drift is documented, not remediated, at this slice.

### SDK sources — clean

| Package | `budgetingDeleteRule` | `deleteRule` | `DeleteRule` | Hard-coded `484` |
| --- | --- | --- | --- | --- |
| `packages/sdk-node` | 0 | 0 | 0 | 0 |
| `packages/sdk-python` | 0 | 0 | 0 | 0 |
| `packages/sdk-php` | 0 | 0 | 0 | 0 |
| `packages/sdk-java` | 0 | 0 | 0 | 0 |
| `packages/sdk-go` | 0 | 0 | 0 | 0 |
| `packages/sdk-ruby` (if present) | 0 | 0 | 0 | 0 |

No SDK method, model, or fixture references the removed operation. c.4 does not force any SDK regeneration.

### Distribution artifacts — clean

| Artifact | Contains removed op? |
| --- | --- |
| `public/sdk-downloads/*` | No |
| `public/apis.json` catalogue entry `apiEndpointCount` | Already tracks live spec (recomputed on load) |
| `public/apis-sandbox.json` | Same |

### Developer portal

Rendered dynamically from `public/openapi.json` at request time. Removal takes effect immediately on next portal render (verified via cached `apis.json` regeneration path). No static portal fixture references the operation.

## Publication guardrail

No publication authorised under c.4V. All drift remediation deferred to the release-gate procedure. When release opens for 4.53.1:

1. Rebuild `Kang_Open_Banking_API_v4.53.1.postman_collection.json` from the current `public/openapi.json` (which will then contain 483 operations).
2. Refresh `Kang_Open_Banking_API_latest.postman_collection.json` alias.
3. Snapshot `public/openapi-history/openapi-4.53.1.json`.
4. Regenerate SDK reference documentation (no SDK code change required).
5. Update developer portal search index cache.

## Summary

| Category | Status |
| --- | --- |
| Live spec | Aligned (JSON=YAML=Sandbox=Catalogue) |
| Historical postman | Preserved as-is (correct) |
| Unreleased postman (v4.53.1, latest) | Drift documented; publish-gate regeneration required |
| SDK sources | No drift |
| Distribution artifacts | No drift |
| Developer portal | No drift (dynamic) |
| Publication under c.4V | None (per authorisation) |
