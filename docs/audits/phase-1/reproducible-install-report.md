
---

## Phase 1A-I — Reproducible Installation Closure (2026-07-16)

### Root cause

Working-tree `package-lock.json` (sha `56a1698d…`) had drifted from `package.json` — several transitive resolutions had newer patch/minor releases published on the registry (protobufjs 1.1.0→1.1.1/1.1.2, rollup native optional bins 4.59.0→4.62.2, `@types/estree` 1.0.8→1.0.9, plus missing entries for `fsevents`, `react-is`, `ansi-styles`, and the new rollup native bins). `npm ci` correctly refused because the lockfile no longer represented a valid install plan for `package.json`.

`package.json` was **not** modified. No dependency range in the manifest was changed. Root cause = stale lockfile only.

### Correction (Option B: metadata-only regeneration)

```
npm install --package-lock-only --ignore-scripts   # npm 10.9.4 / node v22.22.0
```

Regenerated `package-lock.json` in place. Result hash: `316d1cca4066e2b38aab60c9af831ada3b3a3efd8406a1f71ab48e1caa05543e`.

### A. Root-cause analysis

| Item | Evidence | Finding |
|---|---|---|
| Failing package | `npm ci --verbose` | `@types/estree`, `@protobufjs/*`, `@rollup/rollup-linux-x64-{gnu,musl}`, several missing entries |
| Required version (per manifest ranges) | e.g. `@types/estree` ^1.0.6/^1.0.8 by eslint, vitest, lovable-tagger, hast-util-to-jsx-runtime | `1.0.9` |
| Locked version (stale) | old lockfile | `1.0.8` |
| Dependency owner | vitest → `@types/estree ^1.0.8`; registry now resolves to 1.0.9 | transitive |
| npm version | 10.9.4 (project + CI) | consistent |
| Introducing commit | pre-existing drift accumulated over successive registry publishes; unmodified by Phase 1A commits | not a Phase 1A regression |
| Root cause | Stale lockfile vs. registry-resolved ranges in `package.json` | lockfile only |

### B. Files changed

| File | Reason | Before hash | After hash | Rollback |
|---|---|---|---|---|
| `package-lock.json` | Metadata regeneration | `56a1698d…` | `316d1cca…` | `git checkout <prev-commit> -- package-lock.json` |
| `docs/audits/phase-1/quality-gate-integrity-report.md` | Append Phase 1A-I section | — | — | Trim appended section |

No change to `package.json`, source, workflows, backend, DB, SDK, Postman, or docs beyond the audit report.

### C. Dependency changes (highlights, top-level)

131 lockfile entries moved. All are patch/minor movements within existing `package.json` ranges — no manual upgrade. Critical packages (unchanged / expected):

| Package | Before | After | Type | Reason | Risk |
|---|---|---|---|---|---|
| `@types/estree` | 1.0.8 | 1.0.9 | transitive | registry resolution | none — type-only |
| `rollup` (nested under vite) | 4.59.0 | 4.62.2 | transitive | vite@^ range | patch |
| `@firebase/*` | 0.x → 0.x patch bumps | | transitive | firebase@^ range | patch |
| `@protobufjs/*` | 1.1.0 | 1.1.1/1.1.2 | transitive | patch | none |
| React / React DOM | unchanged | unchanged | direct | — | none |
| Vite | unchanged | unchanged | direct | — | none |
| TypeScript | unchanged | unchanged | direct | — | none |
| Supabase | unchanged | unchanged | direct | — | none |
| Capacitor | unchanged | unchanged | direct | — | none |
| Vitest | unchanged | unchanged | direct | — | none |
| Playwright | unchanged | unchanged | direct | — | none |
| ESLint | unchanged | unchanged | direct | — | none |

`@firebase/auth` is still present at `1.13.3` under both `firebase/node_modules/@firebase/auth` and `@firebase/auth-compat/node_modules/@firebase/auth` — the top-level entry was deduped away, not removed. `node_modules/rollup` at 2.80.0 is the hoisted node for `@rollup/plugin-*` peer ranges; `vite` uses its own nested `rollup@4.62.2` for the build path.

### D. Clean-install evidence

| Attempt | Workspace | Command | Exit | Lockfile before | Lockfile after | Status |
|---|---|---|---:|---|---|---|
| 1 | `/tmp/kob-clean` (fresh copy) | `npm ci --ignore-scripts` | 0 | 316d1cca… | 316d1cca… | ✅ |
| 2 | `/tmp/kob-clean2` (fresh copy) | `npm ci --ignore-scripts` | 0 | 316d1cca… | 316d1cca… | ✅ |
| 3 | `/dev-server` (project, `rm -rf node_modules`) | `npm ci` | 0 | 316d1cca… | 316d1cca… | ✅ |

Lockfile hash identical across all three runs. `npm ci` did not mutate the lockfile.

### E. Validation results (post-correction)

| Command | Expected | Actual | Exit | Status |
|---|---|---|---:|---|
| `npm ci` | 0 | 0, 1448 pkgs, 50–55 s | 0 | ✅ |
| `npm ci` (2nd) | 0 | 0 | 0 | ✅ |
| `npm ls @types/estree` | resolves | `@types/estree@1.0.9` | 0 | ✅ |
| `npm run openapi:gates:test` | 35 pass | 35/35 pass | 0 | ✅ |
| `npm run openapi:gates` | 204 fail | 204 (4/3/4/3/29/77/5/0/79) | 1 | ✅ expected |
| `npm run build` | 0 | Vite + PWA + prerender + og-audit green | 0 | ✅ |
| `npm run test` | no new regression | 88 failed / 1193 passed / 7 skipped | 1 | ✅ same as Phase 1R |
| Targeted gate tests | pass | 35/35 pass | 0 | ✅ |
| Targeted `SecuritySettings.test.tsx` | 2/2 pass | 2/2 pass | 0 | ✅ |

### F. Test-suite comparison

| Metric | Before | After | Δ | Status |
|---|---:|---:|---:|---|
| Failing tests | 88 | 88 | 0 | ✅ no regression |
| Passing tests | 1193 | 1193 | 0 | ✅ |
| Skipped | 7 | 7 | 0 | ✅ |
| Unhandled rejections | 0 | 0 | 0 | ✅ |

### G. Production integrity

| Item | Before | After | Changed |
|---|---|---|---|
| API version | 4.53.0 | 4.53.0 | no |
| Operation count | 484 | 484 | no |
| OpenAPI JSON hash | de0adeee6779fdbf6f05bbb87e90cc32a9e7829adc35565ff6c511ef1db09bb9 | (same) | no |
| OpenAPI YAML hash | a6b7c3bd9017db192c1b2bec6d23e99938f7741968047a13d697b3243333c69e | (same) | no |
| Backend handlers | unchanged | unchanged | no |
| DB migrations | none | none | no |
| SDKs / Postman / public docs | unchanged | unchanged | no |

### H. Build-output scan

- `SUPABASE_SERVICE_ROLE_KEY`, `-----BEGIN … PRIVATE KEY-----`, `scripts/fixtures/openapi-quality-gates`: **0 matches** in `dist/`.
- `/v1/v1/` matches remain documentary only (changelog text + regression assertion string in `TranslationManager` chunk) — no runtime URL.

### I. CI toolchain alignment

CI already pins `node-version: '22'` and uses `npm ci --no-audit --no-fund` in `.github/workflows/api-contract-gates.yml` and `dashboard-routing-smoke.yml`. No `--legacy-peer-deps`, no `--force`, no `continue-on-error` on install. Local & CI both run npm 10.9.4 with Node 22.22.0. No CI change required.

### J. Security check

`.npmrc` contains no token; workflows do not print registry credentials; `strict-ssl` untouched; no insecure registry configured. Lockfile changes are transparent patch/minor bumps of already-declared ranges.

### K. Rollback

```
git checkout HEAD~1 -- package-lock.json   # restores 56a1698d… (stale; will re-break npm ci)
```

Rollback is *not* recommended: it re-introduces the drift.

### L. Verdict

Root cause identified, minimal correction applied (lockfile only), clean install reproducible, no regression, contract untouched.
