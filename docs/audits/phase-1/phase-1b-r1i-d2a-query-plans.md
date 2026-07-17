# Phase 1B — R1I-d.2A-DB1 — Query Plans (Evidence Status)

## Status

**OUTSTANDING — not fabricated.**

Section §10 of the R1I-d.2A-DB1 authorisation requires executable
`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` capture, before and after the four
d.2A indexes, against a representative multi-merchant fixture on each of the
four Gateway tables (`gateway_subaccounts`, `gateway_beneficiaries`,
`gateway_payment_links`, `gateway_virtual_accounts`).

The current sandbox provides only a read/insert-limited managed Postgres
connection (no `CREATE INDEX` privileges, no isolated database, no ability to
`ANALYZE` against a controlled corpus). Under the strict anti-hallucination
protocol, no synthetic plans, forced-index outputs, or narrative
approximations are recorded here.

## Required outputs (when executed)

| operationId | Table | Target rows | Limit | Plan-before path | Plan-after path | Index selected |
|---|---|---|---|---|---|---|
| gatewayListSubaccounts | `gateway_subaccounts` | to be filled | 25 | to be filled | to be filled | `idx_gw_subaccounts_merchant_created_id_desc` |
| gatewayListBeneficiaries | `gateway_beneficiaries` | to be filled | 25 | to be filled | to be filled | `idx_gw_beneficiaries_merchant_created_id_desc` |
| gatewayListPaymentLinks | `gateway_payment_links` | to be filled | 25 | to be filled | to be filled | `idx_gw_payment_links_merchant_created_id_desc` |
| gatewayListVirtualAccounts | `gateway_virtual_accounts` | to be filled | 25 | to be filled | to be filled | `idx_gw_virtual_accounts_merchant_created_id_desc` |

## Required post-index properties (per §10)

- authoritative merchant predicate present in the plan;
- keyset predicate present where testing continuation;
- result bounded to `limit + 1`;
- approved index selected under representative cardinality;
- no unbounded sort of the full table;
- no exact-count scan;
- no cross-merchant rows.

Planner settings must not be manipulated. If the approved index is not
selected under representative cardinality the slice returns
`PHASE 1B-R1I-d.2A BLOCKED — APPROVED INDEX DOES NOT SUPPORT REPRESENTATIVE QUERY`.

## Infrastructure prerequisite

An isolated local PostgreSQL 15+ instance (matching Supabase's version) with
CREATE privileges on the four `public.gateway_*` tables and pointed at by
`D2A_HARNESS_PGURL` (see `scripts/slice-d2a-online-index-harness.mjs`) plus a
representative fixture generator (§9). This infrastructure is not present in
the current build sandbox.
