# Phase 1B — R1I-d.2A-DB1 — Database Indexes

## 1. Approved indexes (four, one per d.2A operation — no additions)

| operationId | Table | Index name | Exact definition | Partial predicate |
|---|---|---|---|---|
| gatewayListSubaccounts | `public.gateway_subaccounts` | `idx_gw_subaccounts_merchant_created_id_desc` | `(merchant_id, created_at DESC, id DESC)` btree | none |
| gatewayListBeneficiaries | `public.gateway_beneficiaries` | `idx_gw_beneficiaries_merchant_created_id_desc` | `(merchant_id, created_at DESC, id DESC)` btree | none |
| gatewayListPaymentLinks | `public.gateway_payment_links` | `idx_gw_payment_links_merchant_created_id_desc` | `(merchant_id, created_at DESC, id DESC)` btree | none |
| gatewayListVirtualAccounts | `public.gateway_virtual_accounts` | `idx_gw_virtual_accounts_merchant_created_id_desc` | `(merchant_id, created_at DESC, id DESC)` btree | none |

Counts:

```
Approved indexes: 4
Additional indexes: 0
Later-slice indexes: 0
```

Definitions copied verbatim from
`docs/audits/phase-1/phase-1b-r1i-d2s-database-owner-decisions.md §1`. None
are inferred. The partial-predicate slot (`gateway_customer_tokens WHERE
is_active`) is deferred to d.2C per the ratified plan.

## 2. Uniqueness / access method

All four indexes are non-unique btree. Uniqueness is provided by the `id`
column (UUID PK) already; the composite is for keyset ordering only.

## 3. Exact-definition verification

Both paths (canonical + online) apply the verification matrix from
`phase-1b-r1i-d2a-dual-path-index-design.md §2`:

| Existing state | Result |
|---|---|
| Index absent | Create it |
| Exact valid index present | No-op |
| Same name, wrong definition | **Fail** |
| Exact definition but invalid (`indisvalid = false`) | **Fail** |
| Exact definition but not ready (`indisready = false`) | **Fail** |
| Duplicate equivalent index under another name | Reported for Database Owner review — never silently dropped |

## 4. Checksums

| Artifact | SHA-256 |
|---|---|
| `supabase/pending-migrations/phase-1/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.sql` (corrected canonical) | `c12e370aba360e45531f4332bc1cf4575ea00025665122c97a671527569cae87` |
| `supabase/pending-migrations/phase-1/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.rollback.sql` (canonical rollback) | `1fb06d0bc65e573f5a34971df0d94714198c6029dfdecbf1224dd61a1e79446d` |
| `supabase/pending-operations/phase-1/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.concurrent.sql` (online forward) | `f85983718cf260972444218a99f6bb4409b4db3d1598a86711530ecf8f6bc9d8` |
| `supabase/pending-operations/phase-1/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.concurrent.rollback.sql` (online rollback) | `3e731ae2da323ee246e2af4293c0b4845759b6f976be352f5da296b08c980a5e` |
| `scripts/slice-d2a-online-index-harness.mjs` | `1a3e2099570cdd732d62bc56e735b42e31afa5d5fac9ac6f26727bf73d8fc69d` |

Previous canonical migration checksum (the `CONCURRENTLY` variant recorded in
`phase-1b-r1i-d2a-runtime-design.md` predecessor evidence):
`SUPERSEDED_BEFORE_PROMOTION`. It was **not** applied to any production
database.

Prior Phase 1 migration checksums are unchanged:

- `20260101000000_phase-1b-budgeting-additive.sql` → `53a7228f345c52e43c467a1869e1fb1965754181d34c106c0fc92179cd0e76bf`
- `20260201000000_phase-1b-r1i-c3d-roundup-eligibility-trigger.sql` → `64a779dbcfb4a39b1b795dec57107df9d1c24e0cccad78071fbca57242e4d37e`
- `20260301000000_phase-1b-r1i-c3h-goal-archive-provenance.sql` → `cb383f407a42161cdc9fe34f2e2235c9079e51534ba78aa84ea8f0473fde3a96`

## 5. Runner scope integrity

- No d.2A migration exists under `supabase/migrations/`.
- No online operation exists under `supabase/migrations/`.
- No production workflow automatically executes `supabase/pending-operations/`
  (grep of `.github/workflows/` finds zero references — see
  `phase-1b-r1i-d2a-regression.md`).
