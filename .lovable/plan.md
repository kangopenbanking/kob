

# Add Country Support for Turkey, Ghana, Rwanda, South Africa, Mali, Burkina Faso, Kenya, and UAE

## Summary

The country code list is duplicated across 5 files. Each needs the 8 new countries added. Additionally, a Cameroon-specific phone validator needs to be generalized.

## Changes

### 1. Create shared country codes constant (`src/lib/country-codes.ts`)
Extract the duplicated `COUNTRY_CODES` into a single shared file. The new unified list will include all existing countries plus:

| Country | Code | Flag |
|---------|------|------|
| Turkey | +90 | 🇹🇷 |
| Ghana | +233 | 🇬🇭 |
| Rwanda | +250 | 🇷🇼 |
| South Africa | +27 | 🇿🇦 |
| Mali | +223 | 🇲🇱 |
| Burkina Faso | +226 | 🇧🇫 |
| Kenya | +254 | 🇰🇪 |
| UAE | +971 | 🇦🇪 |

### 2. Update 5 files to import from shared module
Remove the local `COUNTRY_CODES` definition and import from `@/lib/country-codes` in:
- `src/pages/Auth.tsx`
- `src/pages/ProfileSettings.tsx`
- `src/pages/customer-app/CustomerAuth.tsx`
- `src/components/pwa/MobileAuthForm.tsx`
- `src/components/pwa/AccountApplication.tsx`

### 3. Generalize phone validation in `CustomerLinkedAccounts.tsx`
The `validateCameroonPhone` function currently only validates Cameroon (+237) numbers. It will be updated to accept any international phone format matching the supported country codes.

### 4. Edge function compatibility
The backend edge functions (`institution-register`, `phone-auth-send-otp`) already use the generic international format regex `^\+[1-9]\d{6,14}$`, so all new country phone numbers are already supported server-side. No backend changes needed.

