# Registration Hardening — 5 Workstreams

Scoped, additive changes only. No renames of existing endpoints (Guardian Standing Order 1). No removal of passing fields (Order 2). All new routes documented (Order P1, P10).

---

## 1. Dedicated DCR endpoint with SSA/JWT validation

**New edge function**: `supabase/functions/dcr-register-v1/index.ts`
- POST `/v1/dcr/register` (RFC 7591 compliant).
- Validates `software_statement` JWT: signature (RS256/ES256 via JWKS), `iss`, `exp`, `iat`, `software_id`, `redirect_uris` match request.
- Validates `redirect_uris` (HTTPS only, no fragments), `grant_types` (subset of `client_credentials`, `authorization_code`, `refresh_token`), `scope` (allowed list), `token_endpoint_auth_method`.
- Returns RFC 7591 error responses: `invalid_software_statement`, `invalid_redirect_uri`, `invalid_client_metadata` with `error_description`.
- On success: inserts into `tpp_registrations`, returns `{client_id, client_secret, client_id_issued_at, client_secret_expires_at:0, registration_access_token}`. Secret shown once.
- Audit log entry per attempt (success + failure with reason).

**UI wire-up**: `src/pages/tpp/TppRegister.tsx` — call new endpoint, render structured error messages by `error` code, copy-once secret panel.

**Tests**: `supabase/functions/dcr-register-v1/index_test.ts` — valid SSA, expired SSA, bad signature, missing redirect_uris, mismatched redirect_uris, disallowed scope.

---

## 2. Side-by-side registration documentation page

**New route**: `/developer/registration-flows` (public — Order P1/P4).
- File: `src/pages/developer/RegistrationFlowsDocs.tsx`.
- Four-column responsive layout (collapses to tabs on mobile): Personal | Business | Institution | Developer.
- Each column shows: entry route, auth method, required fields table, state machine, MermaidDiagram of the flow, downloadable JSON of required-fields schema.
- Uses existing `MermaidDiagram` component.
- Linked from `/developer` sidebar under "Onboarding".
- Includes a unified state-transition diagram across all four account types.

---

## 3. Registration lifecycle webhook events

**New event types** (additive to `WEBHOOK_EVENT_SCHEMAS`):
- `registration.pending`
- `registration.under_review`
- `registration.approved`
- `registration.rejected`

Each `data.object`: `{id, account_type: 'personal'|'business'|'institution'|'developer', entity_id, status, reason?, reviewer_id?, occurred_at}`.

**Schemas**: extend `src/lib/webhook-event-schemas.ts` + matching `components.schemas` in `public/openapi.json` (Order 4 — additive only).

**Emission points** (edge functions, append after status change, behind existing webhook dispatcher):
- `customer-register`, `merchant-register`, `institution-register`, `dcr-register-v1` → emit `pending`.
- `unified-kyc-gateway` when moved to `under_review` → emit `under_review`.
- `admin-kyc-review`, `admin-kyb-verify`, `admin-institution-approve` → emit `approved` or `rejected` (already step-up gated).

**Tests**: extend `src/test/webhook-event-schemas.test.ts` with positive + negative cases per new event.

---

## 4. KYB requirements checklist UI

**New shared component**: `src/components/kyb/KybRequirementsChecklist.tsx`.
- Props: `requirements: {key, label, description, accept, required, maxBytes}[]`, `files: Record<key, File|StoragePath|null>`, `onChange`.
- Per-row indicator: ✓ uploaded & readable, ⚠ unreadable/over-size, ✗ missing.
- Calls `buildDocumentsPayload`'s metadata read (extracted helper from `src/lib/kyb-documents.ts`) on each file to verify mime+size pre-submit.
- Exposes `isComplete()` and `getBlockingReasons()`; parent disables submit when not complete.

**Wired into**:
- `src/pages/merchant/MerchantKYB.tsx` — replace ad-hoc file rows.
- `src/pages/biz/BizRegister.tsx` (Business PWA) — same component.
- `src/pages/Register.tsx` (Institution) — institution KYB doc step.

**Tests**: `src/test/kyb-requirements-checklist.test.tsx` (vitest + RTL) — blocks submit when any required missing, when any file unreadable.

---

## 5. Admin review queue page

**New route**: `/admin/registration-queue` (admin-only).
- File: `src/pages/admin/RegistrationReviewQueue.tsx`.
- Unified table over: pending consumers (`kyc_verifications`), merchants (`business_kyc`), institutions (`institutions`), TPPs (`tpp_registrations`).
- Filters: account type (multi), institution, status (`pending|under_review|approved|rejected|info_requested`), correlation status (matched/unmatched/manual_review — joined from `audit_logs`), step-up denial reasons (from `audit_logs` event=`step_up_denied`).
- Free-text search by entity id / institution name / submitter email.
- Row click → existing review pages (`/admin/kyc-review`, `/admin/business-kyc`, `/admin/institution-verification`).
- Server-side pagination via `useInfiniteQuery`.
- Linked from admin nav; visible only to `has_role(uid,'admin')`.

---

## Technical notes

- **No DB schema changes required** — webhook events use existing `webhook_inbox`/`gateway_webhook_events`; queue page reads existing tables.
- **No edge function renames** — `dcr-register-v1` is additive; old `dcr-register` (if present) stays as a thin alias.
- **Public routes**: `/developer/registration-flows` and `/openapi.json` continue to be unauthenticated. PERMANENT PUBLIC ROUTES comment preserved.
- **Audit + step-up**: all admin approve/reject paths already emit `audit_logs` with `step_up` metadata — webhook emission piggy-backs after that exists.

## Out of scope

- Re-skinning existing review pages.
- Backfilling historical webhook events for already-approved entities.
- Localizing the new docs page (English only in this pass).
- Mobile push notifications for registration events.

## Suggested execution order

1. Webhook schemas + emission (foundation other features rely on).
2. DCR endpoint + tests.
3. KYB checklist component + wire into 3 pages.
4. Admin review queue.
5. Side-by-side docs page (last, references everything above).
