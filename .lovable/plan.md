## Goal

Enable Virtual Card users to scan any **EMVCo Merchant-Presented QR (MPQR)** code (KOB-issued or external CEMAC merchant) and pay the merchant by debiting their virtual card. Reuse existing infrastructure (`useQRScanner`, `pisp-domestic-payment`, `pos-qr-payment`, virtual card ledger) without breaking current flows.

## How KOB API is enhanced (adaptive, additive)

KOB has no `/qr` endpoint, but already exposes:
- `pisp-create-consent` + `pisp-domestic-payment` + `pisp-payment-submission` (Push payment rail)
- `pos-qr-payment` (signed KOB-internal QRs only)
- `virtual-cards` (balance + ledger)

We add a **thin Bridge edge function** that decodes EMVCo TLV, normalizes the merchant target, then routes to the existing PISP endpoints. No breaking change to OpenAPI — additive only (new path + new schema), version bump per Standing Order 6 (patch → x.y.Z+1).

## Components

### 1. EMVCo decoder (shared TS lib)
`src/lib/emvco-qr.ts` — pure parser, TLV walker, CRC16-CCITT validator. Extracts:
- `merchantName` (tag 59)
- `merchantCity` (tag 60)
- `merchantCategoryCode` (tag 52)
- `currency` ISO-4217 numeric → alpha (tag 53; 950→XAF, 952→XOF)
- `amount` (tag 54, optional → static QR)
- `countryCode` (tag 58)
- `merchantAccountInfo` (tags 26-51, picks first with KOB/MoMo GUID; falls back to raw account ID)
- `qrType`: `static | dynamic`
Mirrored to a Deno copy at `supabase/functions/_shared/emvco-qr.ts`.

### 2. Scanner UI
`src/components/virtual-cards/QRPayScanner.tsx`
- Reuses `useQRScanner` hook (already iOS-safe, dual-engine).
- On decode: parses EMVCo, shows merchant card (name, city, MCC, amount/currency) + amount input for static QRs.
- Card selector pulls user's virtual cards; shows live balance.
- "Pay" button triggers `PinConfirmDialog` (existing) for PIN/biometric step-up.
- Renders success screen with reference ID + merchant name (for merchant verification).

Hooked into `src/pages/banking-app/BankCards.tsx` via a new "Scan & Pay" button next to "New".

### 3. Bridge edge function
`supabase/functions/qr-initiate-payment/index.ts` (new, `verify_jwt = false`, validates JWT in code per house rules).

Request:
```json
{ "qr_payload": "00020101...6304ABCD", "virtual_card_id": "uuid", "amount_override": "5000", "pin_token": "..." }
```

Logic:
1. CORS + `supabase.auth.getUser()` (3-attempt retry per memory).
2. Require `Idempotency-Key` header (UUID v4 regex).
3. Replay check against `qr_payment_idempotency` (existing table).
4. Decode EMVCo via shared lib; reject bad CRC → `400 QR_001`.
5. Validate currency ∈ {XAF, XOF, USD} and country ∈ CEMAC/UEMOA allowlist → else `QR_002`.
6. Resolve merchant:
   - If `merchantAccountInfo.guid === 'KOB'` → look up `gateway_merchants` by embedded merchant_id (internal).
   - Else treat as external CEMAC merchant; insert into `qr_external_merchants` cache with verification status.
7. Verify virtual card: belongs to user, status=`active`, not frozen, `available_balance >= amount`.
8. Verify `pin_token` (existing `verify-step-up` pattern) — fail-closed.
9. Atomic FOR UPDATE on virtual card row → debit + ledger entry (`type=qr_purchase`).
10. Call `pisp-create-consent` → `pisp-domestic-payment` → `pisp-payment-submission` with normalized payload (amount as zero-decimal string for XAF/XOF). Bearer = service-role JWT to internal functions; preserves existing PISP audit trail.
11. Persist row in new `qr_card_payments` table (links virtual_card_id ↔ pisp_payment_id ↔ qr hash).
12. Cache idempotent response.
13. Return `{ status: 'pending'|'completed', reference, merchant, amount, pisp_payment_id }`.

### 4. Webhook → status sync
Extend existing `pisp-webhook-handler` (already wired for PISP events) with a small switch: when payload has matching `qr_card_payments.pisp_payment_id`, update `status` and emit:
- consumer notification (existing notifications table)
- realtime channel `qr-card-payments:user_id` for the success screen
No new webhook endpoint — reuses authoritative inbound webhook per memory.

### 5. Database (migration)
```sql
create table public.qr_card_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  virtual_card_id uuid not null references public.virtual_cards(id),
  pisp_payment_id text,
  qr_hash text not null,
  merchant_name text, merchant_id text, merchant_external boolean default false,
  amount numeric not null, currency text not null,
  status text not null default 'pending',
  idempotency_key text unique not null,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.qr_card_payments enable row level security;
create policy "own rows" on public.qr_card_payments for select using (user_id = auth.uid());
-- inserts/updates only via service role (edge functions)

create table public.qr_external_merchants (
  merchant_key text primary key,  -- guid:account
  display_name text, country_code text, mcc text,
  verification_status text default 'unverified', -- unverified|verified|blocked
  first_seen_at timestamptz default now(), last_seen_at timestamptz default now()
);
alter table public.qr_external_merchants enable row level security;
create policy "read all" on public.qr_external_merchants for select using (true);
```

### 6. OpenAPI + docs (additive, version bump)
- Add `POST /v1/payments/qr-initiate` to `public/openapi.json` + `.yaml` (request/response schemas, RFC7807 errors `QR_001..QR_004`, `Idempotency-Key` required header, `X-RateLimit-*` headers).
- Bump `info.version` (patch).
- Add `docs/developer-portal/payments/qr-initiate.md` with cURL/Node/Python examples (Order P5 + P9).
- Add changelog entry under `docs/governance/CHANGELOG-vX.Y.Z.md`.
- Standards cited: EMVCo MPM Spec v1.1 §4 (TLV), ISO 18245 (MCC), ISO 4217.

### 7. Tests
- `src/test/emvco-qr.test.ts` — fixtures (Cameroon MoMo dynamic, static, bad CRC, KOB-issued).
- `supabase/functions/qr-initiate-payment/index.test.ts` — happy path, replay, bad CRC, insufficient funds, frozen card, currency rejection.
- `e2e/authenticated/virtual-card-qr-pay.spec.ts` — scan stub → PIN → success screen → DB row.

## Security & invariants
- All financial mutations server-side (memory: Direct Backend Mandate + Financial Safety).
- `FOR UPDATE` row lock + idempotency UUID v4.
- PIN/biometric step-up mandatory (memory: MFA Policy).
- `supabase.auth.getUser()` only, never `getSession()`.
- RLS enforced; ledger rows write-only via service role.
- Daily velocity cap reused from `financial-safety-and-automation-infrastructure`.

## Files

Created:
- `src/lib/emvco-qr.ts`
- `src/components/virtual-cards/QRPayScanner.tsx`
- `supabase/functions/_shared/emvco-qr.ts`
- `supabase/functions/qr-initiate-payment/index.ts`
- `supabase/functions/qr-initiate-payment/index.test.ts`
- `supabase/migrations/<ts>_qr_card_payments.sql`
- `src/test/emvco-qr.test.ts`
- `e2e/authenticated/virtual-card-qr-pay.spec.ts`
- `docs/developer-portal/payments/qr-initiate.md`
- `docs/governance/CHANGELOG-vX.Y.Z.md`

Edited:
- `src/pages/banking-app/BankCards.tsx` (add "Scan & Pay" button + dialog)
- `supabase/functions/pisp-webhook-handler/index.ts` (status sync hook)
- `public/openapi.json`, `public/openapi.yaml`, `src/config/version.ts`

Untouched (no breaking change): existing `pos-qr-payment`, `virtual-cards`, all PISP functions, OpenAPI operationIds.
