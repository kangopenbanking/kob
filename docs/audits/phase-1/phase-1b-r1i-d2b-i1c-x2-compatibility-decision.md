# Phase 1B — R1I-d.2B-I1c-X2 — QR Directory Compatibility Decision

**Slice:** R1I-d.2B-I1c-X2 (`merchantsQrDirectoryList`)
**Reviewed base commit:** `9407e2292590f83ed85770cf93dc43f5eb46c2e8`
**R1 review base commit:** `ac711ddb8493a7048f0b7981b6d1d2afeae6995a`
**Active API version:** `4.53.1`
**Release status:** Unreleased
**Operation count:** 483 (unchanged)
**Strategy:** DIRECT CANONICAL REPLACEMENT — EXECUTED AS AN ATOMIC X2-B
CUTOVER
**Parent I1c status:** IN PROGRESS — CROSS-CUTTING PAGINATION-COVERAGE
REMEDIATION

This decision governs the migration of
`GET /v1/merchants/qr-directory` (`merchantsQrDirectoryList`) from its
current bespoke response envelope to the ratified canonical pagination
contract shared by all d.2A / d.2B operations. It is binding on all
downstream sub-slices X2-A through X2-D.

## 1. Legacy runtime shape

Current runtime (`supabase/functions/merchants-qr-directory/index.ts`)
returns:

```json
{
  "object": "list",
  "data": [ /* … */ ],
  "has_more": true,
  "next_cursor": "<raw merchant_id UUID>"
}
```

Legacy characteristics — all **removed** at the X2-B atomic cutover:

- top-level `object: "list"`;
- top-level `has_more` boolean;
- top-level `next_cursor` string;
- **raw UUID cursor** — the `merchant_id` of the last row is echoed
  verbatim as `next_cursor` and accepted verbatim on subsequent requests
  via `cursor=<uuid>`;
- silent `Math.min` / `Math.max` clamping of `limit`;
- no `X-Pagination-*` response headers;
- no `Access-Control-Expose-Headers` entry for pagination.

## 2. Canonical runtime shape (target)

X2-B will emit exactly:

```json
{
  "data": [ /* … */ ],
  "pagination": {
    "mode": "cursor",
    "has_more": true,
    "next_cursor": "kobp1.<payload>.<signature>",
    "limit": 25
  },
  "meta": {}
}
```

with response headers:

```
X-Pagination-Mode: cursor
X-Pagination-Has-More: true|false
X-Pagination-Next-Cursor: <signed cursor or empty string>
X-Pagination-Limit: <effective limit>
Access-Control-Expose-Headers: X-Pagination-Mode, X-Pagination-Has-More, X-Pagination-Next-Cursor, X-Pagination-Limit
```

Ratified constants (§X2-D0):

| Field | Value |
|-------|-------|
| Operation ID | `merchantsQrDirectoryList` |
| Default limit | 25 |
| Maximum limit | 100 |
| Cursor lifetime | 1800 s |
| Ordering | `merchant_id ASC` (unique final tie-breaker) |
| Order profile ID | `qr-directory.merchant-id-asc.v1` |
| Scope tuple | `(environment, visibility="public")` |
| Filter tuple | `(country, category)` |
| Exact total | PROHIBITED |
| Cursor format | `kobp1.<payload>.<signature>` |
| Backward pagination | not supported |
| `offset` / `starting_after` / `ending_before` | not supported |
| Legacy top-level `object` / `has_more` / `next_cursor` | not emitted |

## 3. Raw-UUID cursor retirement

The legacy `next_cursor=<raw UUID>` format is retired at the X2-B atomic
cutover in a single step. There is **no transitional dual-accept
window** at any point:

- X2-A: no runtime change. Legacy raw-UUID cursors remain accepted by
  the existing runtime only because the runtime file is not edited.
- X2-B (atomic): `merchants-qr-directory/index.ts` is rewritten to
  accept **only** `kobp1.*` signed cursors, and every repository-owned
  consumer is migrated in the **same** slice. Raw UUIDs are rejected
  with Problem Details 400 `PAGINATION_CURSOR_INVALID`.
- No in-repo consumer ever observes a raw-UUID cursor after X2-B
  closes, because runtime, contract and consumers migrate together in
  one review-gated commit range.

## 4. Direct canonical replacement — atomic cutover decision

The QR directory endpoint is migrated **in place** at
`GET /v1/merchants/qr-directory`, and runtime, OpenAPI contract, SDK
sources and every repository-owned consumer migrate **together in the
single X2-B slice**. This decision is binding:

- **No new versioned endpoint.** Adding `/v2/merchants/qr-directory`
  would increase the operation count (currently 483) and require an
  API-version bump under Standing Order 6 — neither is authorised.
- **No dual legacy / canonical response.** The runtime returns exactly
  one envelope shape after X2-B; the choice is not controlled by an
  `Accept` header, a query flag, or a client-provided version header.
- **No dual cursor acceptance.** The runtime accepts exactly one cursor
  format after X2-B (signed `kobp1.*`).
- **Direct replacement, not additive.** The change is a direct
  replacement under the Unreleased `4.53.1` contract: the legacy
  top-level fields (`object`, `has_more`, `next_cursor`) are **removed**
  and the canonical nested `pagination` / `meta` fields **replace**
  them. This is a breaking envelope swap, permitted only because
  `4.53.1` has not yet been cut. It MUST NOT be described as “additive
  fields plus deprecation of the legacy envelope” or as a mere
  deprecation.
- **No API-version bump.** The active version remains `4.53.1` in
  `Unreleased` status.
- **No SDK publication.** Repository-owned SDK sources are migrated in
  X2-B for internal consistency, but no `sdk-node`, `sdk-python`, or
  `sdk-php` package is republished by this programme.
- **No deployment.** X2-A / X2-B / X2-C / X2-D are review-gated
  repository slices. Deployment authorisation is a separate decision.
- **No partial X2-B closure.** X2-B is reviewed as one cumulative
  commit range; no runtime-only, contract-only, or consumer-only
  fragment of X2-B may be declared closed independently.

## 5. Sub-slice sequence

| Sub-slice | Scope |
|-----------|-------|
| X2-A (this slice, R1 in progress) | Isolated foundation adapter, adapter tests (including HMAC configuration coverage), protected-baseline test, compatibility decision, AGENTS.md pointer. No runtime, OpenAPI, SDK or consumer change. |
| X2-B — **atomic canonical cutover** (not authorised) | ONE implementation slice covering ALL of: merchants-qr-directory runtime integration; raw-UUID cursor retirement; canonical response body; the four `X-Pagination-*` headers and their CORS exposure; OpenAPI JSON/YAML operation correction for `merchantsQrDirectoryList`; Node SDK source migration; Python SDK source migration; PHP SDK source migration; `useMerchantDirectory` hook migration; developer-page migration; developer documentation migration; smoke-probe migration; QR partner E2E migration; QR regression-test migration; and any additional repository-owned legacy consumer surfaced by search. Reviewed as one cumulative commit range. No partial X2-B component may close independently. |
| X2-C (not authorised) | Disposable local Supabase + Edge Runtime verification only: canonical first page, signed cursor continuation, country/category filter binding, raw-UUID rejection, invalid/expired/tampered cursor rejection, limit validation, response headers, CORS exposure, database ordering, repository-consumer tests, OpenAPI pagination coverage, protected baselines, lint and full-suite evidence. No source change. |
| X2-D (not authorised) | Independent evidence review, final X2 closure, and protected-baseline transition only. No source change. |

## 6. Repository-owned consumer inventory (migrated in X2-B)

The following consumers reference the legacy `object` / `has_more` /
`next_cursor` shape or the raw-UUID cursor. **All** migrate atomically
with the runtime and OpenAPI in X2-B. **None** is modified during X2-A.

- `packages/sdk-node/src/qr.ts`
- `packages/sdk-python/kangopenbanking/qr.py`
- `packages/sdk-php/src/Resources/QRDirectoryResource.php`
- `src/hooks/useMerchantDirectory.ts`
- `src/pages/developer/MerchantsDiscoveryGuide.tsx`
- `docs/developer-portal/payments/qr-merchant-directory.md`
- `scripts/qr-smoke-probes.mjs`
- `e2e/authenticated/qr-partner-flow.spec.ts`
- `src/test/qr-system-regression.test.ts`

This list is authoritative for X2-B entry. A repository-wide search
during X2-B implementation MUST extend this list if another active
consumer referring to `object: "list"`, top-level `has_more`, top-level
`next_cursor`, or a raw-UUID cursor for this endpoint is discovered;
that consumer is then migrated in the same X2-B slice. Historical audit
documents that describe the legacy behaviour are not executable
consumers and are not migrated on that basis alone; only this
compatibility-decision document is amended when the list grows, and no
invariant is relaxed.

## 7. Preserved invariants

- API version: `4.53.1`
- Release status: Unreleased
- Operation count: 483
- Gate total: 176
- Lint ceiling: 5586
- Managed Supabase access: 0
- Deployment: NONE
- SDK publication: NONE
- Protected d.2A / I1a / I1b / I1c artifacts: unchanged.

## 8. Verdict

`DIRECT CANONICAL REPLACEMENT UNDER 4.53.1 UNRELEASED, EXECUTED AS AN
ATOMIC X2-B CUTOVER` is the ratified compatibility strategy for
`merchantsQrDirectoryList`. This document is the authoritative
reference for the remainder of the X2 programme.
