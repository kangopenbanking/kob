# Phase 1B — R1I-d.2A-EV — Execution-Environment Verification (Preflight Block)

## 1. Environment preflight (§1)

| Control | Required | Actual | Status |
|---|---|---|---|
| Host | Local / isolated CI | Shared build sandbox | **FAIL** |
| Production connectivity | Disabled | N/A — no isolated DB present | — |
| Supabase CLI | Available | Absent (`which supabase` → not found) | **FAIL** |
| Docker / PostgreSQL daemon | Available | Absent (`which docker` → not found) | **FAIL** |
| Disposable database | Yes | Only a managed shared Postgres binding | **FAIL** |
| Direct PostgreSQL session | Available | Managed shared endpoint only | **FAIL** |
| Autocommit | Enabled | N/A — pooler binding | **FAIL** |
| Transaction-pool port 6543 | **Not used** | `PGPORT=6543` | **FAIL (explicit violation)** |
| `CREATE INDEX` privilege | Available | Not available (read/insert scope only) | **FAIL** |
| Deno Edge runtime bound to isolated DB | Available | Deno present, no isolated DB to bind | **FAIL** |
| Node / npm | Available | Available | PASS |
| Test cursor secret | Test-only | Not provisioned in this sandbox | **FAIL** |

Section §1 mandates: *"Fail closed if the host is not local or isolated CI. Do not use production or shared staging infrastructure."*

The current sandbox is neither an isolated local host nor a controllable CI runner with disposable-database privileges. It exposes only a managed shared Postgres endpoint over the transaction pooler on port 6543 — the exact configuration the R1I-d.2A-DB1 harness and design explicitly refuse.

## 2. Consequence for §§3–14

Because §1 fails closed:

- §3 (canonical transactional migration through Supabase local reset): cannot execute — no Supabase CLI and no disposable database.
- §4 (online concurrent-operation harness): the harness `scripts/slice-d2a-online-index-harness.mjs` correctly refuses this environment (non-local host and port 6543); running it against a real isolated instance is deferred.
- §5 (canonical/online definition parity): requires both paths to have been executed — deferred.
- §§6–7 (representative fixture + `EXPLAIN (ANALYZE, BUFFERS)` capture): cannot execute — no `CREATE INDEX` privilege, no controllable corpus.
- §§8–11 (live Edge runtime, runtime pagination, cursor and scope security, header + count-drop verification): cannot execute — no isolated database to bind the Edge runtime against.
- §12–§14 (targeted suites, full regression, build/lint/gates/clean install): the targeted contract + foundation suites and the build/lint/gates/version chain remain runnable, but their evidence alone does not satisfy §17 acceptance without the executable database, query-plan, live-runtime, security, header, and count-drop evidence above.

Per the strict anti-hallucination protocol, no synthetic plans, forced-index outputs, fabricated reset hashes, or narrative approximations are recorded.

## 3. Artifact integrity (§2) — unchanged

Checksums recorded in `phase-1b-r1i-d2a-database-indexes.md §4` remain
unchanged this slice (no artifacts modified):

- `20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.sql` — `c12e370aba360e45531f4332bc1cf4575ea00025665122c97a671527569cae87`
- `20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.rollback.sql` — `1fb06d0bc65e573f5a34971df0d94714198c6029dfdecbf1224dd61a1e79446d`
- `pending-operations/…concurrent.sql` — `f85983718cf260972444218a99f6bb4409b4db3d1598a86711530ecf8f6bc9d8`
- `pending-operations/…concurrent.rollback.sql` — `3e731ae2da323ee246e2af4293c0b4845759b6f976be352f5da296b08c980a5e`
- `scripts/slice-d2a-online-index-harness.mjs` — `1a3e2099570cdd732d62bc56e735b42e31afa5d5fac9ac6f26727bf73d8fc69d`
- Previous d.2A migration variant (CONCURRENTLY inside runner): `SUPERSEDED_BEFORE_PROMOTION`
- Promoted d.2A migrations: **0**
- Production operations executed: **0**

## 4. Repository integrity (§15) — unchanged

```
d.2A operations changed:              0 (verification-only slice)
d.2B–d.2F operations changed:         0
Shared foundation changes:            0
Production migrations:                0
Deployments:                          0
SDK/Postman publications:             0
Server-URL changes:                   0
```

R1I-d.2B remains **NOT AUTHORISED**.

## 5. Governance invariants — unchanged

- API version: 4.53.1 (Unreleased)
- Operation count: 483
- Gates: 176 (ceiling unchanged)
- Full lint ceiling: 5586
- Rollup: 4.44.2

## 6. Gate

Per §17: *"Where the required isolated environment remains unavailable, return: `PHASE 1B-R1I-d.2A BLOCKED — ISOLATED LOCAL EXECUTION ENVIRONMENT REQUIRED`. Do not return FAIL solely because the execution environment is unavailable."*

The R1I-d.2A-EV slice therefore closes with the environment-block gate.
Acceptance of R1I-d.2A remains contingent on running this exact protocol in a
host that satisfies §1: Supabase CLI + Docker + a disposable local
PostgreSQL 15 on port 5432 with `CREATE INDEX` privilege and a Deno Edge
runtime bound to that instance.
