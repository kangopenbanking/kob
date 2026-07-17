# Phase 1B — R1I-d.2A-INFRA — Security Ratification (§§3–4, §9, §16)

## 1. Selected execution model (§2)

**Model C** — both developer-local Docker/Supabase and ephemeral CI, driven by
the same environment-neutral scripts under `scripts/phase1b-d2a/`. The scripts
do not depend on any developer-machine configuration; the CI job sets
`D2A_INFRA_HOSTED_POSTGRES=true` to skip Docker orchestration while reusing
every guard, migration, harness, fixture, and query-plan step verbatim.

## 2. Fail-closed guard (§4)

`scripts/phase1b-d2a/guard.mjs` is the single shared guard called by every
d.2A execution script and by the workflow itself. It rejects:

| Reject reason | Guard code |
|---|---|
| Missing `KOB_D2A_DISPOSABLE_ENVIRONMENT=true` marker | `GUARD_MISSING_DISPOSABLE_MARKER` |
| Missing `D2A_HARNESS_PGURL` | `GUARD_MISSING_PGURL` |
| Invalid URL / non-postgres protocol | `GUARD_INVALID_PGURL`, `GUARD_INVALID_PROTOCOL` |
| Transaction-pool port 6543 | `GUARD_TRANSACTION_POOLER_PORT` |
| Non-local / non-private / non-CI-alias host | `GUARD_NON_LOCAL_HOST` |
| Public IPv4 host | `GUARD_PUBLIC_IP_HOST` |
| Managed-service / production / staging keyword in host | `GUARD_FORBIDDEN_HOST_KEYWORD` |
| Missing database name | `GUARD_MISSING_DATABASE_NAME` |
| Protected database name (`postgres`, `production`, `kob`, `template1`, …) | `GUARD_PROTECTED_DATABASE_NAME` |
| Database name without a disposable hint (`test`/`scratch`/`ephemeral`/`disposable`/`ci`/`d2a`) | `GUARD_DATABASE_NAME_NOT_DISPOSABLE` |
| Missing `KOB_CURSOR_HMAC_SECRET` | `GUARD_MISSING_CURSOR_SECRET` |
| Secret shorter than 32 characters | `GUARD_CURSOR_SECRET_TOO_SHORT` |
| Secret containing `prod` / `production` / `live` / `release` / `master` | `GUARD_CURSOR_SECRET_LOOKS_PRODUCTION` |

The guard NEVER prints connection passwords or complete database URLs. The
verified `phase1b-d2a-infra-guard.test.ts` asserts a secret embedded in the
URL is absent from the guard's stdout.

## 3. Test-only cursor secret handling (§9)

- Variable name: `KOB_CURSOR_HMAC_SECRET`.
- Minted at workflow runtime via `openssl rand -hex 32` (64 hex chars, 256
  bits of entropy).
- Written only to `$GITHUB_ENV` for the job's process scope. Never persisted
  to disk, never committed, never uploaded as an artifact.
- Teardown clears the process-scoped variable
  (`scripts/phase1b-d2a/teardown.mjs`).
- The guard rejects any value containing `prod`, `production`, `live`,
  `release`, or `master` substrings, and any value shorter than 32
  characters, so a production secret cannot be substituted by mistake.

## 4. Workflow permissions (§8, §16)

`.github/workflows/phase1b-r1i-d2a-verification.yml`:

```
permissions:
  contents: read
```

No `id-token: write`, no `packages: write`, no `deployments: write`, no
production or staging environments, no publication steps, no release/tag
steps, no cloud database credentials, no SDK/Postman publication.

The workflow uses `concurrency` with `cancel-in-progress: true` scoped to
the ref, and a hard 30-minute job timeout.

## 5. Repository change scope (§16)

**Permitted and delivered:**
- `.github/workflows/phase1b-r1i-d2a-verification.yml` (new; narrowly-scoped
  CI workflow)
- `scripts/phase1b-d2a/guard.mjs` (new; fail-closed guard)
- `scripts/phase1b-d2a/bootstrap.mjs` (new; environment start)
- `scripts/phase1b-d2a/teardown.mjs` (new; environment stop)
- `scripts/phase1b-d2a/fixture.mjs` (new; deterministic synthetic fixture)
- `scripts/phase1b-d2a/query-plans.mjs` (new; EXPLAIN capture)
- `scripts/phase1b-d2a/runtime-tests.mjs` (new; router integration entrypoint)
- `src/test/phase1b-d2a-infra-guard.test.ts` (new; static infra tests)
- `package.json` (added `phase1b:d2a:*` scripts only — no dependency changes,
  no lockfile movement)
- Six audit reports in `docs/audits/phase-1/`

**Prohibited and NOT delivered:**
- 0 d.2A runtime behaviour changes
- 0 OpenAPI changes
- 0 shared pagination-foundation changes
- 0 migration or index-definition changes
- 0 d.2B–d.2F changes
- 0 production workflow / deployment script changes
- 0 application dependency upgrades
- 0 lockfile movement
- 0 version or operation-count changes

## 6. Redaction posture

- `runGuard` prints only redacted host (`***.***.***.***` style), port,
  database, marker, CI flag, and secret-presence boolean.
- Bootstrap and teardown scripts log structured JSON without passwords or
  full connection strings.
- Query-plan output includes only planner output and index-usage booleans;
  no credentials.
- Uploaded artifact (`query-plans.jsonl`) does not include environment
  variables or connection metadata.
