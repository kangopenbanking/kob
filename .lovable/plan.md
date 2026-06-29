## Scope guardrails
- No changes to business logic, compliance language, maturity tags, info.description, paths, operationIds, schema names, or response shapes.
- Additive/cosmetic edits only: SDK metadata, doc version strings, one broken externalDocs URL, one stale Postman quickstart pointer, SDK README rewrites, and the runbook page already exists (verified, not recreated).

## What I found (audit results)

**SDK reality check — `info.x-sdk-libraries` in `public/openapi.json` v4.51.5:**

| SDK | Listed package | Listed repo | Reality |
|---|---|---|---|
| node | `@kang/openbanking-node` v1.6.1 | `kangfinance/openbanking-node` | npm 403 (not published), repo 404. **Actually published**: `@kangopenbanking/sdk` v1.7.0 (npm 200). Local pkg repo `kangopenbanking/sdk-node` also 404. |
| python | `kang-openbanking` v1.6.1 | `kangfinance/openbanking-python` | pypi 200 (legacy name); repo 404. Local pyproject ships as `kangopenbanking` v1.7.0 (pypi 200). |
| php | `kang/openbanking-php` v1.6.1 | `kangfinance/openbanking-php` | packagist 404 ("Package not found"), repo 404. Local composer ships `kangopenbanking/sdk` v1.7.0 (packagist 200). |
| java | "generated" v4.40.0 | `kangopenbanking/KangOpenBanking-KOB` | repo 404 → not publicly available. |
| go | v1.6.1 | `kangopenbanking/sdk-go` | repo 404, pkg.go.dev 404, only a stub `go.mod` locally → not published. |
| ruby | "community-guide" v1.0.0 | same KOB repo | repo 404. |

**Other gaps:**
- `tags[BankConnectors].externalDocs.url` = `/developer/banks/connector-runbook` → **404 route**. Real runbook page is `BankConnectorRunbook.tsx` mounted at `/developer/connectors/bank-connector-runbook` (already rich content — 4 phases, 9 statuses, simulator). No content work needed, only URL fix.
- `ConnectorModeSelection.tsx` links to `/developer/bank-connector-runbook` (also 404 — missing `/connectors/` segment).
- Postman pipeline is healthy (manifest + latest both at 4.51.5), but `manifest.json.collection.quickstart` is pinned to `v4.43.0` — stale pointer to retire or refresh.
- SDK READMEs (`packages/sdk-node/README.md`, `sdk-python`, `sdk-php`) still say "v1 API (v1.2.0)" — drift from spec 4.51.5.
- No "generated from spec vX.Y.Z" stamp on getting-started/quickstart pages.

## Diff list (what will change)

### 1. `public/openapi.json` + `public/openapi.yaml` — `info.x-sdk-libraries` rewrite

Rewrite ONLY this block. No other spec edits.

- **node**: replace with real published package
  - `name`: `@kangopenbanking/sdk`
  - `version`: `1.7.0`
  - `status`: `available`
  - `package_manager`: `https://www.npmjs.com/package/@kangopenbanking/sdk`
  - Remove `repository` (no public repo — repo url would 404).
- **python**: keep available, point at the actually-installable name
  - `name`: `kangopenbanking`
  - `version`: `1.7.0`
  - `status`: `available`
  - `package_manager`: `https://pypi.org/project/kangopenbanking/`
  - Remove `repository` (404).
- **php**: switch to real package
  - `name`: `kangopenbanking/sdk`
  - `version`: `1.7.0`
  - `status`: `available`
  - `package_manager`: `https://packagist.org/packages/kangopenbanking/sdk`
  - Remove `repository` (404).
- **go**: demote to planned (no package, no repo)
  - `status`: `planned`, keep `name` placeholder, remove `version`, `package_manager`, `repository` (or set to docs URL only).
- **java**: demote to planned (repo 404)
  - `status`: `planned`, remove `repository` and `package_manager`, keep `generator` + `docs` reference.
- **ruby**: keep `status: community-guide` but remove broken `repository` URL.

Also bump `public/openapi-sandbox.json` + `.yaml` `x-sdk-libraries` identically.

### 2. SDK READMEs (`packages/sdk-node`, `sdk-python`, `sdk-php`)

Replace the "v1 API (v1.2.0)" string with `KOB API v4.51.5`. Confirm Quick Start fields use snake_case + string monetary amounts as required by the live spec. No new API surface added. Mirror copy into `public/sdk-downloads/sdk-*-README.md` so what's served on the portal matches packages/.

### 3. Bank connector externalDocs URL (1-line spec fix)

In `public/openapi.json` + `.yaml`, change:
`tags[BankConnectors].externalDocs.url` from `/developer/banks/connector-runbook` → `/developer/connectors/bank-connector-runbook`.

Page already exists with full runbook content (phases, statuses, sandbox simulator, mTLS/file-feed coverage). No content rewrite. If gaps are found while re-reading the page (e.g. mTLS rotation steps or push/pull/hybrid worked example missing), add them as additive sections only — no changes to the spec.

### 4. Fix sibling broken link

`src/pages/developer/ConnectorModeSelection.tsx` — change `to="/developer/bank-connector-runbook"` → `to="/developer/connectors/bank-connector-runbook"`.

### 5. Docs-to-spec version stamp

Add a small `<p className="text-xs text-muted-foreground">Docs generated from API spec v{KOB_API_VERSION}</p>` line (sourced from `src/config/version.ts`) on:
- `GettingStarted.tsx`
- `QuickStart.tsx`
- `gateway/GatewayQuickstart.tsx`

So future drift is visible at a glance.

### 6. Postman pipeline cleanup

In `public/postman/manifest.json`, drop the stale `collection.quickstart` field pinned to v4.43.0 (or repoint it to the current `Kang_Open_Banking_API_latest.postman_collection.json`). Do not touch the auto-generated versioned/latest pointers — those are already current.

### 7. Dead-link sweep summary table (no code; included in report)

After edits, re-run a curl pass on every URL in:
- `info.contact`, `info.license`, `info.termsOfService`
- every `x-sdk-libraries[*].{repository,package_manager,docs}`
- every `tags[*].externalDocs.url`

Report `200/404/redirect` for each. Any remaining 404 outside the SDK block gets removed (not rewritten around).

## Out of scope (explicitly NOT touching)

- info.description licensing/compliance disclaimer
- maturity (`x-maturity`) tags
- Any operationId, schema name, path, or response shape
- Standing Order locks (SO1–SO7, P1–P10)
- Version bump of `info.version` — these are corrections to false metadata, not new API surface. If the version-sync gate (`scripts/check-version-sync.mjs`) requires a patch bump, I will only bump `4.51.5 → 4.51.6` and add a changelog entry titled "Developer-readiness corrections: SDK metadata + runbook link" — no other content.

## Final report shape (delivered after build)

```
REMOVED
- info.x-sdk-libraries.node.repository (404)
- info.x-sdk-libraries.python.repository (404)
- info.x-sdk-libraries.php.repository (404)
- info.x-sdk-libraries.ruby.repository (404)
- public/postman/manifest.json.collection.quickstart (stale v4.43.0)

FIXED
- node package: @kang/openbanking-node → @kangopenbanking/sdk (npm 200)
- python package: kang-openbanking → kangopenbanking (pypi 200)
- php package: kang/openbanking-php → kangopenbanking/sdk (packagist 200)
- All four available SDK versions: 1.6.1 → 1.7.0 (matches packages/)
- tag BankConnectors externalDocs URL → /developer/connectors/bank-connector-runbook
- ConnectorModeSelection internal link → same
- SDK READMEs: "v1 API (v1.2.0)" → "KOB API v4.51.5"
- Added "Docs generated from API spec v4.51.5" stamp on 3 quickstart pages

NOW PLANNED (no longer presented as available)
- go SDK — status: planned, no install command shown
- java SDK — status: planned, no repo/install shown
- ruby SDK — kept community-guide, broken repo URL removed
```
