# Phase 1B — R1I-d.2B-I1c-R1 — Validator and Post-Sync Provenance Review

**Base commit:** `90222aaa7cc69e8e81ccc51e0aea7cc27a6af7d2`
**I1c implementation commit:** `9325220e53d84ea562b86806d3d91e6845ca863e`
**I1c verification commit:** `2e733fa931baa9767d0a8e6c7e5e9870de37dd60`

## Scope of this repair

R1I-d.2B-I1c-R1 addresses two independent findings raised on the R1I-d.2B-I1c
independent review:

1. `src/test/phase1b-d2b-openapi-parity.test.ts` carried a file-level
   `eslint-disable @typescript-eslint/no-explicit-any` directive and used
   `any` throughout. Its mutation tests asserted on the mutated fixture
   itself rather than on any real validator, so a bug in the validator
   logic would not have been caught.
2. The automatic post-I1c sync commit
   `2e733fa9 → 90222aaa` had not been proved harmless in-suite. The suite
   did not assert which files the auto-sync touched, whether `openapi.json`
   was mutated, or whether the changelog gained new release entries.

Only two files were permitted for this repair:

- `src/test/phase1b-d2b-openapi-parity.test.ts`
- `docs/audits/phase-1/phase-1b-r1i-d2b-i1c-r1-validator-and-post-sync-review.md`

No OpenAPI, adapter, runtime, migration, workflow, or deployment file was
changed.

## What the repair does

### 1. Remove the lint suppression

The file-level `eslint-disable` was removed. Every explicit `any` was replaced
with narrow OpenAPI interfaces (`OpenApiDoc`, `PathItem`, `OperationObject`,
`ParameterObject`, `ResponseObject`, `SchemaObject`) or with `unknown` plus a
type guard (`isRef`). No `ts-ignore`, `ts-nocheck`, or unsafe global cast was
added.

Confirmation:

```
npx eslint src/test/phase1b-d2b-openapi-parity.test.ts --max-warnings=0
→ 0 errors, 0 warnings, 0 suppressions
```

### 2. One real contract validator

`validateI1cContract(jsonCandidate, yamlCandidate, i1bBaseline, d2aBaseline)`
is a pure function that returns a stable list of `I1cIssueCode` values. The
issue-code union is:

```
VERSION_CHANGED
OPERATION_COUNT_CHANGED
JSON_YAML_DRIFT
D2A_OPERATION_CHANGED
UNRELATED_OPERATION_CHANGED
COMPONENT_CHANGED
TARGET_PATH_CHANGED
LIMIT_INVALID
CURSOR_MISSING
OFFSET_NOT_DEPRECATED
SORT_CONTRACT_INVALID
ORDERING_DOCUMENTATION_MISSING
PAGINATION_HEADER_MISSING
FORBIDDEN_TOTAL_PRESENT
BACKWARD_PAGINATION_ADDED
SUBSCRIPTION_FILTER_BINDING_MISSING
ERROR_RESPONSE_CHANGED
```

For the current HEAD spec pair, the validator returns `[]`; the HEAD contract
test asserts exactly this.

### 3. Mutation coverage

Every mutation test now clones a valid candidate, introduces exactly one
targeted mutation, calls `validateI1cContract`, and requires the expected
issue code via `expect(issues).toContain(...)`. Coverage:

| Mutation                                       | Required issue code                  |
|------------------------------------------------|--------------------------------------|
| version changed                                | VERSION_CHANGED                      |
| operation added                                | OPERATION_COUNT_CHANGED              |
| operation removed                              | OPERATION_COUNT_CHANGED              |
| d.2A operation changed                         | D2A_OPERATION_CHANGED                |
| unrelated operation changed                    | UNRELATED_OPERATION_CHANGED          |
| reusable component changed                     | COMPONENT_CHANGED                    |
| limit above 100                                | LIMIT_INVALID                        |
| cursor removed                                 | CURSOR_MISSING                       |
| offset deprecation removed                     | OFFSET_NOT_DEPRECATED                |
| ascending sort added                           | SORT_CONTRACT_INVALID                |
| id tie-breaker documentation removed           | ORDERING_DOCUMENTATION_MISSING       |
| pagination header removed                      | PAGINATION_HEADER_MISSING            |
| total added to response body                   | FORBIDDEN_TOTAL_PRESENT              |
| backward pagination added                      | BACKWARD_PAGINATION_ADDED            |
| JSON/YAML drift                                | JSON_YAML_DRIFT                      |
| subscription plan_id binding removed           | SUBSCRIPTION_FILTER_BINDING_MISSING  |
| subscription status binding removed            | SUBSCRIPTION_FILTER_BINDING_MISSING  |
| error response changed                         | ERROR_RESPONSE_CHANGED               |

All 17 mutation tests pass (17/17).

### 4. Post-sync provenance

The suite now asserts, for the commit range `2e733fa9 → 90222aaa`:

- `git diff --name-only` between the two commits is exactly
  `{CHANGELOG.md, public/CHANGELOG.md, public/changelog.json, public/openapi.yaml}`;
- `public/openapi.json` at HEAD is byte-identical to `9325220e:public/openapi.json`;
- `public/openapi.yaml` at HEAD deep-equals `public/openapi.json` at HEAD;
- `changelog.apiVersion` remains `4.53.1`;
- `changelog.entries` length remains 88 and matches the pre-sync length;
- after normalising only `lastUpdated`, `index.generated_at`, and the Markdown
  “Last updated: **YYYY-MM-DD**” token, the changelog JSON and both Markdown
  changelog files are deep-equal to the pre-sync versions;
- the per-entry `version` list is unchanged (no release entry added);
- no deployment claim was added — the count of any of
  `deployed`, `released to production`, `shipped to prod`,
  `prod deployment`, or `go-live` is unchanged in each changelog file.

## Cross-cutting `openapi-pagination-coverage` finding

`openapi-pagination-coverage.test.ts` reports 2 failing tests:

- `every list endpoint uses the PaginatedResponse envelope` — 5 endpoints:
  - `GET /v1/merchants/qr-directory`
  - `GET /v1/webhooks/dlq`
  - `GET /v1/agents`
  - `GET /v1/agents/{agentId}/transactions`
  - `GET /v1/remittance/cemac/corridors`
- `every list endpoint declares a cursor-style param` — 1 endpoint:
  - `GET /v1/agents/{agentId}/transactions`

The same failures — same paths, same shape — exist at the I1b closure
commit `1485c5593d5b712043564ee68a7274eacb8f185d`. Verified by running the
same envelope + cursor-parameter analysis against the spec extracted from
`1485c559:public/openapi.json`:

- I1b `noEnv`: `['GET /v1/merchants/qr-directory', 'GET /v1/webhooks/dlq', 'GET /v1/agents', 'GET /v1/agents/{agentId}/transactions', 'GET /v1/remittance/cemac/corridors']`
- I1b `noCur`: `['GET /v1/agents/{agentId}/transactions']`

No new coverage failure was introduced by I1c. This is a pre-existing
cross-cutting condition. Remediation requires modifying non-d.2B operations,
which is prohibited under R1I-d.2B-I1c-R1. R1I-d.2B remains BLOCKED on its
own authorised cross-cutting remediation slice; R1I-d.2B-I1c-R1 does not
attempt to touch it.

## Managed Supabase access

0

## Deployment

NONE

## Verdict

PHASE 1B-R1I-d.2B-I1c-R1 READY FOR INDEPENDENT REVIEW.

I1c is NOT claimed PASS. I1d has NOT begun.
