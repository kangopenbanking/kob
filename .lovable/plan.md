

# Unify Auth Forms Across Desktop and Mobile Apps

## Current Inconsistencies Found

After reviewing all three auth surfaces, here are the key gaps:

### 1. MobileAuthForm (Consumer + Banking apps) vs Desktop Auth.tsx

| Feature | Desktop `/auth` | Mobile `MobileAuthForm` |
|---------|----------------|------------------------|
| Country selector | Static `COUNTRY_CODES` | `useSupportedCountries('banking')` from DB |
| Captcha | Manual math question (separate step) | Auto-solved captcha (invisible to user) |
| Forgot password | Not available | Full flow with email reset |
| Reset PIN | Not available | OTP-verified PIN reset |
| PIN setup on login | Not enforced after OTP login | Enforced if no `pin_code_hash` |
| Single session | Not enforced | `enforceSingleSession()` called |
| Sound feedback | None | Success/error sounds |
| Toast library | `useToast` (shadcn) | `toast` (sonner) |
| Background | Clean white (no gradient) | Gradient `from-primary/5` |

### 2. BusinessRegister vs Desktop Auth.tsx (merchant registration)

| Feature | Desktop `/auth` (merchant) | `/biz/register` |
|---------|---------------------------|-----------------|
| Business types | 5 types | 10 types (includes freelancer, e-commerce, SaaS) |
| Fields | Name, type, email, phone, country | Name, type, description, email, phone, contact person, country, currency |
| Backend call | `identity-register` edge function | Direct `gateway_merchants` insert |
| Background | Clean white | Gradient |

## Plan

### A. Update MobileAuthForm to match desktop design patterns
1. Replace gradient background with clean white/card background (no gradient, matching desktop)
2. Switch from sonner `toast` to shadcn `useToast` for consistency with desktop
3. Use static `COUNTRY_CODES` with fallback to `useSupportedCountries` (or vice versa — align both to use `useSupportedCountries`)

### B. Add missing login features to Desktop Auth.tsx
1. Add forgot password flow (email-based reset) to login mode
2. Add PIN reset via OTP flow
3. Enforce `enforceSingleSession()` after successful login
4. Add sound feedback (`sounds.success()`, `sounds.error()`) on login/register
5. Check `pin_code_hash` after OTP login and force PIN setup if missing
6. Add auto-solve captcha for PIN login (matching mobile's invisible captcha)

### C. Update BusinessRegister to match desktop patterns
1. Remove gradient background, use clean white card layout
2. Expand desktop merchant registration to include the additional fields from BusinessRegister (description, contact person, currency)
3. Align business types list across both (use the fuller 10-type list)

### D. Align country selector across all forms
1. Update both Auth.tsx and MobileAuthForm to use `useSupportedCountries()` hook consistently for the country/dial-code selector

### Files to modify

| File | Changes |
|------|---------|
| `src/pages/Auth.tsx` | Add forgot password, reset PIN, single session, sounds, PIN enforcement on OTP login, auto-captcha for PIN, expanded merchant fields, aligned country selector |
| `src/components/pwa/MobileAuthForm.tsx` | Remove gradient, switch to `useToast`, align country selector source |
| `src/pages/business-app/BusinessRegister.tsx` | Remove gradient, align visual style with desktop cards |

