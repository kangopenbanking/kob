<!--
================================================================================
Kang Open Banking — Pull Request Template
================================================================================
Every PR must complete the relevant sections below. Sections marked REQUIRED
are gating: a Guardian will request changes if any required box is unchecked
without justification.

Cite Standing Orders and external standards (RFC, FAPI, PCI, OBIE) by number.
================================================================================
-->

## Summary

<!-- 1–3 sentences. What changes, why, and which surface (spec, edge function,
DB migration, dashboard UI, docs, SDK). -->

## Type of change

- [ ] Patch — non-breaking additive change (new field, new endpoint, new doc)
- [ ] Minor — new endpoint group or schema (no removals/renames)
- [ ] Major — breaking change (rename, removal, required-field tightening)
- [ ] Fix — bug fix in existing surface (no contract change)
- [ ] Infra — CI / tooling / governance only (no runtime impact)
- [ ] Docs only

## Surfaces touched

- [ ] `public/openapi.json` / `public/openapi.yaml`
- [ ] `supabase/migrations/`
- [ ] `supabase/functions/`
- [ ] `src/` (frontend dashboards / PWAs)
- [ ] `packages/sdk-*` (published SDKs)
- [ ] `docs/public/` or `docs/developer-portal/` (public docs)
- [ ] `.github/workflows/` or `scripts/` (CI / ratchets)

---

## Guardian Standing Orders compliance — REQUIRED

<!-- Tick every applicable box. Cite the standard/RFC where prompted. -->

### ORDER 1 — The Lock
- [ ] No `operationId`, `paths` key, schema name, security scheme name, or
      component parameter/header name has been **renamed or removed**.
- [ ] If any of the above were renamed/removed, this PR includes a major
      `info.version` bump (e.g. 4.x.y → 5.0.0) AND Guardian sign-off below.

### ORDER 2 — The Ratchet
- [ ] `npm run quality:gates` (or `node scripts/openapi-quality-gates.mjs`)
      passes locally with **0 failures across all G1–G7 gates**.
- [ ] No previously-required field, enum value, response code, or security
      scheme has been removed.

### ORDER 3 — The Audit Trail
- [ ] Every spec/contract change cites at least one external standard.
      Cite here: <!-- e.g. RFC 7807 §3.1, FAPI 1.0 ADV §5.2.2, PCI DSS 4.0 §8.3 -->

### ORDER 4 — The Surgeon Rule
- [ ] All changes are **additive first**. Removals/renames flagged above.

### ORDER 5 — The Dead Code Rule
- [ ] Every new schema, parameter, header, or security scheme added to
      `components` is referenced by at least one operation in this PR.

### ORDER 6 — The Version Gate
- [ ] `info.version` in `public/openapi.json` and `public/openapi.yaml` is
      bumped according to the change type (patch / minor / major).
- [ ] `changelog.json` has a new entry for the bumped version with summary,
      highlights, additions, deprecations, fixes, and standard_citations.

### ORDER 7 — The Five Roles
- [ ] Editor session reinstated the five roles (Guardian, Architect, Surgeon,
      Auditor, Scorekeeper) before any contract edits.

### ORDERS P1–P10 — Public Developer Docs (only if `docs/public/` or
`docs/developer-portal/` was touched)
- [ ] **P1 Public First** — page is reachable anonymously.
- [ ] **P2 Zero-404** — moved/renamed pages have 301 redirects in
      `public/_redirects` or `netlify.toml`.
- [ ] **P3 Free Sandbox** — no sandbox feature placed behind paid plan.
- [ ] **P4 Open Spec** — `/openapi.json` and `/openapi.yaml` remain
      anonymous-downloadable.
- [ ] **P5 Working Code** — every new code example runs against the published
      sandbox using documented test credentials.
- [ ] **P6 Complete Content** — no link-only pages; each page has explanation
      + code + diagram/table.
- [ ] **P7 Changelog** — entry filed within 48h of API change.
- [ ] **P9 Multi-Language** — examples include cURL + Node.js + Python at
      minimum (Quickstart/Go-Live add PHP, Java, Go).
- [ ] **P10 Living Docs** — docs updated within 7 days of spec release.

---

## Database migration safety — REQUIRED if `supabase/migrations/` touched

- [ ] All new tables enable `ROW LEVEL SECURITY` and define explicit policies.
- [ ] All new SQL functions declare `SECURITY DEFINER` and `SET search_path = public`.
- [ ] No `ALTER DATABASE postgres` statements.
- [ ] No triggers attached to `auth`, `storage`, `realtime`,
      `supabase_functions`, or `vault` schemas.
- [ ] No CHECK constraints relying on non-immutable functions (e.g. `now()`).
      Use validation triggers instead.
- [ ] If a financial-balance column is touched: row-level lock (`FOR UPDATE`)
      and UUID v4 `idempotency_key` enforced.
- [ ] Migration is **forward-only** and idempotent (`IF NOT EXISTS` /
      `IF EXISTS` guards).

## Edge function safety — REQUIRED if `supabase/functions/` touched

- [ ] CORS headers included in **all** responses (success and error).
- [ ] Input validated with Zod (or equivalent) — no trusting client input.
- [ ] No raw SQL; only parameterized client calls or named RPC functions.
- [ ] JWT validated in code via `supabase.auth.getUser(token)` (never
      `getSession()`).
- [ ] No secrets logged. Errors use `safeErrorResponse` / `obErrorResponse`
      with stable error IDs.
- [ ] If function mediates a financial mutation: row-level lock + idempotency
      key + audit-log row written.

## Frontend / Dashboard changes — only if `src/` touched

- [ ] No new colors hardcoded in components — semantic tokens from
      `index.css` / `tailwind.config.ts` only.
- [ ] No emojis, no gradient backgrounds/buttons (workspace rule).
- [ ] Lucide outline icons only.
- [ ] On any data-mutation: `refetchQueries` called to bypass stale cache.
- [ ] Auth-gated routes use `<RoleGuard>`; public docs routes remain unguarded.

---

## Test evidence — REQUIRED

Paste the relevant outputs (commands + last 10 lines is fine).

```
$ node scripts/openapi-quality-gates.mjs
<output>
```

```
$ bunx vitest run        # if frontend logic changed
<output>
```

```
$ npx playwright test    # if UI/route surface changed
<output>
```

For DB migrations, paste the linter result:

```
$ supabase db lint       # or the migration tool's linter output
<output>
```

---

## Risk assessment

- **Blast radius**: <!-- which dashboards, which user roles, which endpoints? -->
- **Rollback plan**: <!-- how do we revert if this lands badly in prod? -->
- **Data backfill required?** <!-- yes/no; if yes, link the script -->

## Linked issues / docs

- Closes #
- Audit doc:
- Changelog entry: `changelog.json` v<!-- e.g. 4.26.9 -->

---

## Reviewer checklist (for Guardians)

- [ ] All ORDER 1–7 boxes ticked or justified in writing.
- [ ] Public-docs orders P1–P10 satisfied for any docs change.
- [ ] DB migration RLS + `SECURITY DEFINER` + `search_path` verified.
- [ ] Quality-gate output shows 0 failures.
- [ ] Changelog entry cites at least one external standard.
- [ ] No emoji / no gradient drift in UI diffs.
