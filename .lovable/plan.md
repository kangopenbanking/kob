

# Plan: Cameroon Banking Account Identifiers (RIB + IBAN)

## Current State

The `accounts` table already has a flexible identification model:
- `identification_scheme` enum: `LOCAL_BANK | MOMO | IBAN`
- `identification_value`: stores the actual account number
- `secondary_identification`: available for additional data (e.g., BIC/SWIFT)

The existing `validate-iban` edge function already handles full IBAN validation with MOD-97 checksum for 60+ countries including Cameroon (CM, 27 chars).

**What's missing**: No `DOMESTIC_RIB` scheme, no RIB-specific validation, no structured RIB display, and no RIB-aware lookup in transfers.

---

## Phase 1: Database Schema Enhancement

Add `DOMESTIC_RIB` to the `account_scheme` enum and add optional structured columns to `accounts`:

```sql
ALTER TYPE account_scheme ADD VALUE IF NOT EXISTS 'DOMESTIC_RIB';

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS rib_bank_code VARCHAR(5),
  ADD COLUMN IF NOT EXISTS rib_branch_code VARCHAR(5),
  ADD COLUMN IF NOT EXISTS rib_account_number VARCHAR(11),
  ADD COLUMN IF NOT EXISTS rib_key VARCHAR(2),
  ADD COLUMN IF NOT EXISTS swift_bic VARCHAR(11),
  ADD COLUMN IF NOT EXISTS account_country CHAR(2) DEFAULT 'CM';
```

All new columns are nullable with no impact on existing rows.

---

## Phase 2: RIB Validation Edge Function

Create `supabase/functions/validate-rib/index.ts`:
- Input: `{ rib: string, country?: string }`
- Validates exactly 23 digits for CM
- Extracts structured fields: bank code (5), branch code (5), account number (11), RIB key (2)
- Validates the RIB key using the standard French/CEMAC MOD-97 algorithm
- Derives the CM IBAN automatically (CM21 + 23-digit RIB = 27 chars)
- Returns: `{ valid, bank_code, branch_code, account_number, rib_key, derived_iban, formatted_display, errors }`

---

## Phase 3: Unified Account Identifier Validation Edge Function

Create `supabase/functions/validate-account-identifier/index.ts`:
- Input: `{ type: "DOMESTIC_RIB" | "IBAN" | "LOCAL_BANK" | "MOMO", country?: string, value: string }`
- Routes to RIB or existing IBAN validation logic
- Returns normalized result with `rail` determination:
  - `DOMESTIC_RIB` + CM → rail `DOMESTIC`
  - `IBAN` → rail `INTERNATIONAL`
  - `LOCAL_BANK` / `MOMO` → rail `LOCAL`
- Returns display formatting (RIB: `XXXXX-XXXXX-XXXXXXXXXXX-XX`, IBAN: groups of 4)

---

## Phase 4: Cameroon Bank Directory Edge Function

Create `supabase/functions/directory-banks-cm/index.ts`:
- Returns a static catalog of major Cameroon banks with: `bank_code` (5 digits), `bank_name`, `swift_bic`, `supports_rib: true`
- Covers: Afriland First Bank (10005), BICEC (10029), Société Générale (10033), UBA Cameroon, Ecobank, NFC Bank, BGFI Bank, etc.

---

## Phase 5: Enhance Beneficiary Creation

Update `supabase/functions/gateway-create-beneficiary/index.ts`:
- Accept optional `account_identifier: { type, country, value }` field
- When `type` is `DOMESTIC_RIB`, validate using RIB logic and store structured fields in metadata
- When `type` is `IBAN`, validate using existing IBAN logic
- Auto-populate `bank_code` from the RIB's first 5 digits and look up `bank_name` from the directory

---

## Phase 6: Enhance Transfer Rail Selection

Update `supabase/functions/api-transfers/index.ts`:
- Add a 4th lookup tier: resolve destination by `DOMESTIC_RIB` value (match against `identification_value` where `identification_scheme = 'DOMESTIC_RIB'`)
- When creating transaction records, include `rail` in `merchant_details`:
  - Same institution → `internal`
  - Different institution, both CM → `domestic_interbank`
  - IBAN destination → `international`

---

## Phase 7: Frontend — Send Money with RIB/IBAN Support

Update `BankSendMoney.tsx`:
- Add identifier type selector (Account Number / RIB / IBAN)
- When RIB is selected, show formatted input mask and validate 23 digits
- When IBAN is selected, validate format client-side
- Pass `identifier_type` to the transfer API

---

## Phase 8: Update OpenAPI Spec & Postman Collection

Update `public-api-spec` and `postman-collection` edge functions:
- Add `/v1/standards/validate-rib` path and schema
- Add `/v1/standards/validate-account-identifier` path and schema
- Add `/v1/directory/banks/cm` path
- Add `AccountIdentifier`, `DomesticRIB`, `RailType` schemas
- Add `DOMESTIC_RIB` to the `AccountScheme` enum in docs

---

## Files Created
- `supabase/functions/validate-rib/index.ts`
- `supabase/functions/validate-account-identifier/index.ts`
- `supabase/functions/directory-banks-cm/index.ts`

## Files Modified
- Database migration (add enum value + columns)
- `supabase/functions/gateway-create-beneficiary/index.ts`
- `supabase/functions/api-transfers/index.ts`
- `src/pages/banking-app/BankSendMoney.tsx`
- `supabase/functions/public-api-spec/index.ts`
- `supabase/functions/postman-collection/index.ts`

## Zero Breaking Changes
- Existing `LOCAL_BANK`, `MOMO`, `IBAN` schemes remain untouched
- All existing transfer flows continue working identically
- New columns are all nullable — no existing rows affected
- No existing routes or endpoints modified in breaking ways

