# Phase 1B — R1I-d.2B-I1c-X2 — QR Directory Compatibility Decision

**Slice:** R1I-d.2B-I1c-X2 (`merchantsQrDirectoryList`)
**Reviewed base commit:** `9407e2292590f83ed85770cf93dc43f5eb46c2e8`
**Active API version:** `4.53.1`
**Release status:** Unreleased
**Operation count:** 483 (unchanged)
**Strategy:** DIRECT CANONICAL REPLACEMENT

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

Legacy characteristics preserved by X2-A but **retired at X2-B**:

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

The legacy `next_cursor=<raw UUID>` format is retired at X2-B in a single
step. There is no transitional dual-accept window:

- X2-A: no runtime change. Legacy raw-UUID cursors remain accepted by
  the existing runtime because the runtime file is not edited.
- X2-B: `merchants-qr-directory/index.ts` is rewritten to accept **only**
  `kobp1.*` signed cursors. Raw UUIDs are rejected with Problem Details
  400 `PAGINATION_CURSOR_INVALID`.
- X2-C: all repository-owned consumers are migrated in the same slice as
  the runtime cutover, ensuring no in-repo consumer sees a raw-UUID
  cursor after X2-B closes.

## 4. Direct canonical replacement decision

The QR directory endpoint is migrated **in place** at
`GET /v1/merchants/qr-directory`. This decision is binding:

- **No new versioned endpoint.** Adding `/v2/merchants/qr-directory`
  would increase the operation count (currently 483) and require an
  API-version bump under Standing Order 6 — neither is authorised.
- **No dual legacy / canonical response.** The runtime returns exactly
  one envelope shape after X2-B; the choice is not controlled by an
  `Accept` header, a query flag, or a client-provided version header.
- **No dual cursor acceptance.** The runtime accepts exactly one cursor
  format after X2-B (signed `kobp1.*`).
- **No API-version bump.** The active version remains `4.53.1` in
  `Unreleased` status. The change is scoped to the OpenAPI operation
  shape under the ratchet rules — additive fields plus deprecation of
  the legacy envelope, executed while the version has not yet been
  cut.
- **No SDK publication.** Repository-owned SDK sources are migrated in
  X2-C for internal consistency, but no `sdk-node`, `sdk-python`, or
  `sdk-php` package is republished by this programme.
- **No deployment.** X2-A / X2-B / X2-C / X2-D are review-gated
  repository slices. Deployment authorisation is a separate decision.

## 5. Sub-slice sequence

| Sub-slice | Scope |
|-----------|-------|
| X2-A (this slice) | Isolated foundation adapter, adapter tests, protected-baseline test, compatibility decision, AGENTS.md pointer. No runtime, OpenAPI, SDK or consumer change. |
| X2-B (not authorised) | Rewrite `merchants-qr-directory/index.ts` to use the X2-A adapter. Reject raw-UUID cursors. Emit the four `X-Pagination-*` headers and `Access-Control-Expose-Headers`. |
| X2-C (not authorised) | Migrate repository-owned consumers (see §6). |
| X2-D (not authorised) | OpenAPI contract canonicalisation for `merchantsQrDirectoryList` under version `4.53.1` Unreleased. |

## 6. Repository consumers that must migrate in X2-C

The following consumers reference the legacy `object` / `has_more` /
`next_cursor` shape or the raw-UUID cursor. **None** is modified during
X2-A.

- `packages/sdk-node/src/qr.ts`
- `packages/sdk-python/kangopenbanking/qr.py`
- `packages/sdk-php/src/Resources/QRDirectoryResource.php`
- `src/hooks/useMerchantDirectory.ts`
- `src/pages/developer/MerchantsDiscoveryGuide.tsx`
- `docs/developer-portal/payments/qr-merchant-directory.md`
- `scripts/qr-smoke-probes.mjs`
- `e2e/authenticated/qr-partner-flow.spec.ts`
- `src/test/qr-system-regression.test.ts`

This list is authoritative for X2-C entry. If a repository-wide search
during X2-C discovers an additional consumer referring to `object:
"list"`, top-level `has_more`, top-level `next_cursor`, or a raw-UUID
cursor for this endpoint, that consumer **must** be added to this list
and migrated in the same X2-C slice. Only the compatibility-decision
document is amended; no invariant is relaxed.

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

`DIRECT CANONICAL REPLACEMENT UNDER 4.53.1 UNRELEASED` is the ratified
compatibility strategy for `merchantsQrDirectoryList`. This document is
the authoritative reference for the remainder of the X2 programme.
