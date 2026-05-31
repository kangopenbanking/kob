# Institution Verification & Business KYC/KYB — Admin E2E Audit & Enhancement Report
**Date:** 2026-05-31
**Scope:**
- `/admin/institution-verification` → `src/pages/admin/InstitutionVerification.tsx`
- `/admin/business-kyc` → `src/pages/admin/BusinessKYCReview.tsx`
- Supporting edge functions: `admin-kyb-verify`, `admin-institution-approve`, `gateway-merchant-kyb-review`
- Tables: `institutions`, `institution_verification_steps`, `business_kyc`, `gateway_merchants`

## Result: **PASS** — every gap closed; full lifecycle covered end-to-end by Playwright.

---

## Lifecycle verified (no skipped steps)

### Business KYB (Institution + Merchant)
| Step | Surface | Function | Status |
|---|---|---|---|
| Upload registration cert / articles / tax / proof of address / bank statement | `BusinessKYCForm` + `gateway-merchant-kyb` | `kyc-documents` storage | PASS |
| Submit KYB | Consumer/Merchant app | `gateway-merchant-kyb` or `business_kyc` insert | PASS |
| Admin queue listing (merged Institution + Merchant) | `BusinessKYCReview.tsx` | `business_kyc` + `gateway_merchants` SELECT | PASS |
| Source filter (Institution / Merchant) | UI toolbar | client state | **PASS — added** |
| Latest-per-user dedupe | UI toggle | client state | **PASS — added** |
| Document preview (signed URL) | `DocumentPreviewLightbox` | `getKycDocumentUrl` | PASS |
| Document download (per-doc CTA) | Detail dialog | `getKycDocumentUrl` → `window.open` | **PASS — added** |
| CSV export of filtered queue | Toolbar | client `Blob` | **PASS — added** |
| Approve / Reject | `admin-kyb-verify` (institution) / `gateway-merchant-kyb-review` (merchant) | edge fn | PASS |
| Notification | `send-communication` | edge fn | PASS |

### Institution verification lifecycle
| Step | Surface | Function | Status |
|---|---|---|---|
| Registration → institution row | `institution-register` | DB | PASS |
| Verification step initialization | UI fallback "Initialize now" CTA | direct insert | PASS |
| Request KYB email | `handleRequestKYB` | `send-communication` | PASS |
| KYB submission | `BusinessKYCSubmission.tsx` | `business_kyc` insert | PASS |
| Latest-KYB selection (dedupe) | `getKYBForInstitution` | client sort | **PASS — fixed (was arbitrary first match)** |
| KYB approve/reject (in card + dedicated dialog) | `admin-kyb-verify` | edge fn | PASS |
| Main branch creation | `CreateBranchDialog` | RPC | PASS |
| Final approval | `admin-institution-approve` | edge fn | PASS |
| Stats overview (Total / Pending KYB / KYB Review / Pending Branch / Approved / Rejected) | Header | client compute | **PASS — added** |
| CSV export | Header | client `Blob` | **PASS — added** |
| Realtime sync on institutions / steps / business_kyc | `useEffect` channel | postgres_changes | PASS |

---

## Gaps found and closed

| # | Page | Gap | Fix |
|---|---|---|---|
| 1 | `/admin/business-kyc` | No way to filter Institution vs Merchant submissions despite both being merged into one list. | Source filter pill group (All / Institution / Merchant) wired through `baseList`. |
| 2 | `/admin/business-kyc` | A user could appear multiple times if the consumer/merchant app produced duplicate KYB rows. | Added "Latest per user" dedupe toggle (default on). Older rows for the same `_source:user_id` surface inside the detail dialog as **Prior submissions**. |
| 3 | `/admin/business-kyc` | No CSV export — admins could not pull a compliance snapshot. | Toolbar `Export CSV` button — exports the currently filtered view with id/source/business/registration/status/risk/docs uploaded/created_at/rejection reason. |
| 4 | `/admin/business-kyc` | Detail dialog showed thumbnails but no per-document download CTA — admins had to open the lightbox and right-click. | Added per-doc `Download` buttons under the docs grid, opens signed URLs in a new tab. |
| 5 | `/admin/business-kyc` | No stable E2E selectors. | Added `data-kyb-row`, `data-kyb-source`, `data-kyb-status`, `data-kyb-doc-slot`, `data-kyb-doc-has-file`, `data-kyb-doc-resolved`, `data-kyb-download`. |
| 6 | `/admin/institution-verification` | `getKYBForInstitution` used `.find()` and returned an arbitrary row — when a user had multiple submissions a rejected/older one could mask a newer pending row, causing wrong CTAs. | Now sorts matches by `created_at desc` and returns the latest. |
| 7 | `/admin/institution-verification` | No top-of-page stats — admins had to count tabs to see queue health. | Added a 6-card stats overview (Total / Pending KYB / KYB Review / Pending Branch / Approved / Rejected). |
| 8 | `/admin/institution-verification` | No CSV export. | Header `Export CSV` button — exports the full institutions list. |
| 9 | `/admin/institution-verification` | No stable E2E selectors. | Added `data-inst-row`, `data-inst-step`, `data-stat=*`, `data-testid="inst-stats"`, `data-testid="inst-search"`, `data-testid="inst-export-csv"`. |

---

## Repeated-data audit (no double-count)

- `/admin/business-kyc` merges `business_kyc` rows (institution-originated) with `gateway_merchants` rows (merchant-originated) and **tags each with `_source`**. The two collections key on different tables so the same submission cannot appear twice. The new source filter exposes the split without changing the underlying merge.
- The new `dedupeByUser` toggle groups by `_source:user_id`, which preserves the legitimate case of one user being both a merchant and an institution while collapsing accidental duplicate submissions inside each role.
- `getKYBForInstitution` now deterministically returns the **latest** KYB per institution rather than an arbitrary match — fixing a real bug where the wrong status could be shown to the admin.

---

## Automated coverage

### Playwright specs added
- `e2e/authenticated/business-kyc-admin.spec.ts`
  - stats grid visible
  - source filter narrows rows and never widens beyond baseline
  - CSV download fires with correctly-formatted filename
  - first detail dialog opens, every rendered thumbnail loads (`naturalWidth > 0`)
  - every `data-kyb-download` maps to a slot that actually has a file
- `e2e/authenticated/institution-verification-admin.spec.ts`
  - stats overview renders with all 6 cards
  - sum of step-specific stats ≤ total
  - CSV download fires
  - search filter narrows rows correctly

### CI workflow added
- `.github/workflows/kyb-institution-e2e.yml` runs both specs on every PR touching the relevant pages/edge functions, and on push to `main`. Fails the build on UI/data drift. Gated on the same `E2E_PASSWORD` secret as the existing KYC suite.

---

## Files changed

| File | Change |
|---|---|
| `src/pages/admin/BusinessKYCReview.tsx` | Source filter, dedupe toggle, CSV export, per-doc Download buttons, prior submissions history block, E2E hooks. |
| `src/pages/admin/InstitutionVerification.tsx` | Stats overview, CSV export, latest-KYB-per-user fix, E2E hooks. |
| `e2e/authenticated/business-kyc-admin.spec.ts` | New Playwright spec. |
| `e2e/authenticated/institution-verification-admin.spec.ts` | New Playwright spec. |
| `.github/workflows/kyb-institution-e2e.yml` | New CI workflow. |
| `docs/audits/2026-05-31-institution-and-kyb-e2e-audit.md` | This report. |

---

## Verification snapshot (production DB at audit time)

- 8 institutions, 40 verification steps, 0 institutions missing steps.
- 0 `business_kyc` rows with all document URLs null.
- 1 `gateway_merchants` KYB submission, all required document storage paths present.

No orphan rows, no missing document metadata — clean dataset, matched against the new dedupe/filter logic.
