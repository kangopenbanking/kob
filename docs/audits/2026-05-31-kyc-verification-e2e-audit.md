# /admin/kyc-verification — E2E Audit & Enhancement Report
**Date:** 2026-05-31  
**Scope:** Admin KYC review console (`src/pages/admin/KYCVerificationReview.tsx`), submission edge function (`kyc-submit`), review edge function (`admin-kyc-review`), customer-facing `KYCVerification.tsx`, and `kyc_verifications` table.

## Lifecycle (verified end-to-end)

| Step | Actor | Path / Function | Result |
|---|---|---|---|
| Upload front/back/selfie | Customer | `DocumentUploader` → `kyc-documents` storage | PASS — 10 MB cap, MIME allowlist (jpeg/png/webp/pdf), per-user folder. |
| Submit KYC | Customer | POST `kyc-submit` | PASS — zod-validated, server-side dedup blocks pending/approved resubmits (409). |
| Admin queue listing | Admin | `kyc_verifications` SELECT with profiles join | PASS — paginated 1000/page, all rows fetched. |
| Preview docs (thumbnails) | Admin | `getKycDocumentUrl` signed URLs | PASS — 1 hr expiry, legacy public URLs handled. |
| Lightbox preview | Admin | `DocumentPreviewLightbox` | PASS. |
| Approve / Reject / Request info | Admin | POST `admin-kyc-review` | PASS — RBAC (admin/compliance_officer/moderator/institution), state-machine guard (409 if not pending), required reason/message validation, audit_logs insert, app_notifications insert, email + push (non-blocking). |
| Notification to customer | Customer | `send-communication` + `push-notification` | PASS. |

## Gaps found and closed in this pass

| # | Gap | Fix |
|---|---|---|
| 1 | Historic duplicate rows for the same user (e.g. 3 pending rows for `b1153abf…`) were displayed independently, polluting the queue. | Added client-side "Latest per user" dedupe toggle (on by default). Older rows for the same user are surfaced inside the detail dialog under **Prior submissions**, with status, source-app, timestamp, and short id. |
| 2 | `source_app` column existed in the DB but was invisible in the UI — admins could not tell whether a submission came from the Consumers app or Banking app. | Added a **Source** column, a per-row source badge, the source badge in the detail dialog, and a **Source app** filter (`all` / Consumer / Banking). |
| 3 | The `info_requested` status had a tab + count but no stat card, so the 4-card grid silently dropped a state. | Expanded stats grid to 5 cards (Total / Pending / Info Requested / Approved / Rejected), responsive `grid-cols-2 md:grid-cols-3 lg:grid-cols-5`. |
| 4 | No way to export the review queue for compliance reporting. | Added **Export CSV** button — exports the currently filtered view with id, user, status, source_app, document fields, timestamps, rejection reason. |
| 5 | `Download` icon was imported but unused; admins could only preview docs inline. | Added per-document **Download Front / Back / Selfie** buttons in the detail dialog (opens signed URL in a new tab). |
| 6 | Detail dialog could overflow on small viewports (no internal scroll, applicant info row not wrapping). | Added `max-h-[80vh] overflow-y-auto` and `flex-wrap` on the header row. |
| 7 | Filter toolbar was single-input on one line — broke on narrow screens. | Switched to `flex-wrap` toolbar with search, source filter, dedupe switch, and CSV export. |

## Already correct (no change needed)

- **Server-side dedup**: `kyc-submit` blocks 409 on existing pending/approved.
- **Rejection/info_requested reason gating**: client UI disables submit when reason missing; edge function enforces the same.
- **RBAC** is enforced server-side in `admin-kyc-review`; UI hides action buttons via `useKycReviewPermissions`.
- **State machine**: review function returns 409 if status is not `pending`.
- **Audit log**: every approve/reject/info_requested writes `audit_logs` with reviewer roles, target user, and reason.
- **Notifications**: email + in-app notification + push notification fan-out, each non-blocking.
- **Institution scope**: `institution` role is constrained to its own customers via accounts/staff_assignments lookup.
- **Storage**: KYC docs stored as paths, not public URLs; admin previews use 1 hr signed URLs.

## Manual E2E checks performed

1. Admin → `/admin/kyc-verification` loads with stats, tabs, filters.
2. Toggle **Latest per user** off → all 3 historic rows for the duplicate user appear; on → only the most recent.
3. Source filter narrows to Consumer / Banking correctly.
4. Search by name, email, or document number filters live.
5. Open detail dialog → applicant, source badge, status badge render; thumbnails generate signed URLs; download buttons open originals in a new tab; prior submissions list shows older rows for the duplicate user.
6. Approve / Reject / Request info open the confirmation dialog; rejection/info_requested require a reason (button disabled until typed); approve writes status, audit_logs entry, notification.
7. CSV export downloads `kyc-submissions-YYYY-MM-DD-HHMM.csv` with the current filter view.

## Files changed

- `src/pages/admin/KYCVerificationReview.tsx` — dedupe, source filter/badge, info_requested stat, CSV export, download buttons, history block, responsive toolbar/dialog.
- `docs/audits/2026-05-31-kyc-verification-e2e-audit.md` (this report).

## Result

**PASS** — admin can fully manage KYC end-to-end across Consumer and Banking apps with no remaining gaps.
