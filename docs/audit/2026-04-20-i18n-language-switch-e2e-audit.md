# E2E Audit — Language Switching (English ↔ French)

**Date:** 2026-04-20  
**Scope:** Public website, Customer PWA, Business PWA, Banking PWA, Admin Portal, Merchant Portal, FI Portal, Developer Portal, transactional emails & in-app notifications.  
**Mode:** Read-only discovery. **Zero code or schema changes in this pass.**  
**Stack reference:** `src/lib/i18n/*`, `supabase/functions/{translate-strings, register-translation-strings, translation-auto-translate-cron}`, tables `translation_strings`, `translation_values`, `user_preferences.language`.

---

## 1. Executive Summary

| Layer | Status | Score |
|---|---|---|
| **Translation backend (DB + cron + AI)** | ✅ Production-grade | **95 / 100** |
| **French content coverage in DB** | ✅ 100% (4,620 / 4,620 strings translated) | **100 / 100** |
| **Public marketing site** | ✅ Functional switch, hardcoded strings remain in some sections | **75 / 100** |
| **Customer PWA (`/app`)** | ⚠️ Harvester runs, **no switcher in UI**, **no `useLanguage` consumers** in 47 pages | **35 / 100** |
| **Business PWA (`/biz`)** | ⚠️ Same as above (38 pages) | **35 / 100** |
| **Banking PWA** | ⚠️ Same as above (29 pages) | **35 / 100** |
| **Admin Portal (`/admin`)** | ❌ **No switcher**, 0 / 92 files use `t()` | **15 / 100** |
| **Merchant Portal (`/merchant`)** | ❌ **No switcher**, 0 / 45 files use `t()` | **15 / 100** |
| **FI Portal (`/fi-portal`)** | ⚠️ Imports `useLanguage` but no switcher; 4 keys used | **30 / 100** |
| **Developer Portal (`/developer`)** | ❌ **No switcher**, 0 / 172 files use `t()` | **10 / 100** |
| **Transactional emails (~30 templates)** | ❌ **Hard-coded `lang="en"`**, no locale plumbing | **5 / 100** |
| **In-app notifications (`app_notifications`)** | ❌ Stored as static English | **10 / 100** |
| **`<html lang>` runtime sync** | ❌ Static `lang="en"` in `index.html`, never updated | **0 / 100** |
| **Overall weighted system maturity** | **🟠 Partial — backend ready, surfaces not wired** | **42 / 100** |

**Headline finding:** The translation **infrastructure is excellent and complete** (100% French coverage in the DB, auto-harvest + auto-translate pipeline operational). The **gap is consumer-side adoption** — only 6 files in the entire 959-file `src/` tree call `useLanguage()`, and the language switcher exists in only 2 public-site nav components. Switching to French today produces no visible change inside any authenticated dashboard or PWA.

---

## 2. Methodology

| Phase | Action | Tool |
|---|---|---|
| 1 | Inventory i18n primitives, providers, switcher mounts | `grep`, `code--search_files` |
| 2 | Map adoption per app surface (count of `useLanguage` consumers) | shell |
| 3 | Query DB for string/value counts, FR coverage, freshness | `psql` |
| 4 | Inspect cron + edge functions (`translate-strings`, `auto-translate-cron`) | `code--view` |
| 5 | Audit email templates and notification path for locale awareness | `grep` |
| 6 | Identify gaps & propose batched remediation | synthesis |

No write operations were issued. No edge functions deployed. No schema migrated.

---

## 3. Backend Translation Infrastructure — ✅ Strong

### 3.1 Database state
```
translation_strings_total : 4,620
translation_values_total  : 9,240   (en + fr)
fr_coverage_pct           : 100.00 %
auto_translated_fr        : 4,570
manual_fr                 : 50
last harvest              : 2026-04-20 22:04:29 UTC
last fr translation       : 2026-04-20 22:04:30 UTC
```

### 3.2 Pipeline
- **Runtime harvester** (`TranslationHarvester.tsx`) walks the DOM on every route change, FNV-1a-hashes English strings, queues them to `register-translation-strings`.
- **Auto-translate cron** (`translation-auto-translate-cron`) ticks every interval, translating up to **200 strings per run** via `translate-strings` (Lovable AI Gateway → `google/gemini-2.5-flash`).
- **Realtime subscription** in `LanguageContext.tsx` reloads translations when admins edit them.
- **Storage**: `translation_values (string_id, language, value, is_auto_translated, translated_at, translated_by)` — clean schema, indexed unique on `(string_id, language)`.

**Verdict:** Production-quality, no gaps in the backend tier.

---

## 4. Frontend Adoption — ❌ Critical Gap

### 4.1 `useLanguage()` consumers across the project

```
TOTAL .tsx/.ts files in src/   : 959
Files importing useLanguage    : 6
   - src/App.tsx                   (provider only)
   - src/components/Navigation.tsx (public nav)
   - src/components/DynamicNavigation.tsx
   - src/components/LanguageSwitcher.tsx
   - src/components/i18n/TranslationHarvester.tsx
   - src/pages/FIPortal.tsx        (4 keys)
```

### 4.2 LanguageSwitcher mount points

| Surface | Has switcher? | Notes |
|---|---|---|
| Public marketing site | ✅ | `Navigation.tsx`, `DynamicNavigation.tsx` |
| Customer PWA (`CustomerAppLayout`) | ❌ | Harvester yes, switcher no |
| Business PWA (`BusinessAppLayout`, `UnifiedBusinessLayout`) | ❌ | Same |
| Banking PWA (`BankingAppLayout`) | ❌ | Same |
| Admin Portal (`AdminLayout`) | ❌ | No harvester either |
| Merchant Portal (`MerchantLayout`) | ❌ | No harvester either |
| Developer Portal (`DeveloperLayout`) | ❌ | No harvester either |
| FI Portal (`FIPortal.tsx`) | ❌ | Hook used, switcher missing |

### 4.3 Per-surface adoption (files using `useLanguage`)
```
src/components/customer-app  files=  6   useLanguage = 0
src/components/business-app  files=  8   useLanguage = 0
src/components/banking-app   files=  3   useLanguage = 0
src/components/admin         files= 18   useLanguage = 0
src/components/merchant      files=  2   useLanguage = 0
src/components/developer     files= 29   useLanguage = 0
src/pages/customer-app       files= 47   useLanguage = 0
src/pages/business-app       files= 30   useLanguage = 0
src/pages/banking-app        files= 26   useLanguage = 0
src/pages/admin              files= 74   useLanguage = 0
src/pages/merchant           files= 43   useLanguage = 0
src/pages/developer          files=143   useLanguage = 0
```

**Implication:** Even with 100% DB coverage, switching to French changes *nothing* inside dashboards because no component reads from the translation store. Only the 4 strings in `FIPortal.tsx` actually translate.

---

## 5. Persistence & Bootstrap — ⚠️ Partial

| Concern | Status | Detail |
|---|---|---|
| `localStorage` fallback | ✅ | `LanguageContext` reads/writes `language` key |
| `user_preferences.language` upsert | ✅ | Survives device switches for logged-in users |
| Initial paint flash (FOUT) | ⚠️ | Provider starts at `'en'`, swaps after async load — visible flicker on FR users |
| `<html lang>` attribute sync | ❌ | `index.html` hard-codes `lang="en"`, never updated by `setLanguage` — breaks SEO, screen readers, browser translate prompts |
| `dir` (RTL) handling | ➖ | N/A for FR; needs design before adding `ar` |
| Date / number locale (`Intl`) | ❌ | `toLocaleString()` calls use browser default, ignore `language` state |
| Currency formatting | ❌ | XAF amounts always English-formatted |

---

## 6. Notifications & Emails — ❌ Critical Gap

### 6.1 Transactional email templates (`supabase/functions/_shared/transactional-email-templates/`)
30+ React-Email templates **all hard-code** `<Html lang="en" dir="ltr">` and English copy:
```
api-key-created · chat-assigned · consent-authorized · consent-revoked
crediq-monthly-report · crediq-score-change · crediq-tip-recommendation
crediq-weekly-digest · high-value-alert · kyc-status-update
loan-application-received · loan-status-update · login-alert
merchant-onboarded · password-changed · payment-confirmation
payment-received · payout-processed · rent-payment-reminder
statement-ready · support-reply · support-ticket-created · welcome
```
Auth flow templates (`signup`, `recovery`, `magic-link`, `email-change`, `invite`, `reauthentication`) — same.

### 6.2 In-app notifications
`app_notifications` rows store `title` and `message` as **frozen English strings** at insert time. There is no per-language rendering layer; switching language post-insert does not change any past notification.

### 6.3 Push / OneSignal
No locale targeting — payloads sent in English regardless of recipient preference.

**Recommendation pattern:** introduce a `templates × locales` resolver — every email function reads `user_preferences.language` and selects the matching template (or falls back to `en`). For app notifications, store a `string_key + params` pair instead of finalized text, render at display time via `t()`.

---

## 7. Public Site Hardcoded Strings (sample)

`HeroSection.tsx`, `SecuritySection.tsx`, `BrandName.tsx` and most landing components contain raw English text not routed through `t()`. The harvester picks them up at runtime, so DB coverage exists, but **the components never read it back** — they render the literal English no matter the user's language.

---

## 8. Security & Compliance Considerations

| Concern | Status |
|---|---|
| RLS on `translation_strings` / `translation_values` | ✅ Public read, admin write |
| `register-translation-strings` rate limiting | ⚠️ Verify per-IP cap (recommended audit Batch L) |
| `translate-strings` AI gateway cost ceiling | ⚠️ No daily cap visible — recommend monitoring |
| PII in harvested strings | ⚠️ Harvester filters numeric/URL/code, but personal names in a profile page could be queued — recommend `data-no-i18n` audit on dynamic regions |

---

## 9. Watchlist (do-not-touch without approval)

- ✅ Translation pipeline (harvester + cron + AI gateway) — already excellent, leave alone.
- ✅ DB schema for `translation_strings` / `translation_values` — additive only.
- ✅ Existing `LanguageContext` API surface — preserve `t()`, `language`, `setLanguage`, `isLoadingTranslations`.

---

## 10. Proposed Remediation Batches

Each batch ≤ 1 day of work, requires your explicit approval before execution.

| Batch | Title | Files (est.) | Effort | Risk |
|---|---|---|---|---|
| **K1** | Mount `LanguageSwitcher` in **all 7 dashboard layouts** (Admin, Merchant, FI, Developer, Customer, Business, Banking) | 7 | S | 🟢 Low |
| **K2** | Sync `<html lang>` and `<html dir>` attributes from `LanguageContext` on every change | 1 (Context) + 1 (index.html cleanup) | XS | 🟢 Low |
| **K3** | Add `TranslationHarvester` to Admin / Merchant / Developer / FI layouts so coverage extends to those surfaces | 4 | XS | 🟢 Low |
| **K4** | Fix initial-paint flash: bootstrap `language` synchronously from `localStorage`, defer DB hydration | 1 | S | 🟢 Low |
| **K5** | Locale-aware `Intl` helpers — wrap `toLocaleString` + `Intl.NumberFormat` + `Intl.DateTimeFormat` in a `useFormat()` hook bound to current language | 1 new hook + targeted refactor in 5 hot spots | M | 🟡 Med |
| **K6** | **Email locale routing** — every transactional email function resolves recipient's `user_preferences.language`, uses FR template when present, else `en` | ~30 templates + ~25 send functions | L | 🟡 Med |
| **K7** | Generate French versions of the 30 transactional email templates (one-shot Lovable AI translation, then human review queue for top 10) | 30 new `.fr.tsx` files | L | 🟢 Low |
| **K8** | **In-app notification refactor** — store `string_key + params_json` instead of frozen text; render at display via `t()` | 1 schema migration + ~40 insertion sites | XL | 🟠 High (touches existing rows; needs back-compat shim) |
| **K9** | OneSignal push: append `language` user-tag, send per-locale payloads | 2 | S | 🟢 Low |
| **K10** | Convert top-30 hardcoded English strings on landing pages (`HeroSection`, `SecuritySection`, `BrandName`, etc.) to `t()` calls | ~15 components | M | 🟢 Low |
| **K11** | Add Cypress / Playwright smoke test: switch to FR on each layout, assert at least 5 visible strings change | 7 specs | M | 🟢 Low |
| **K12** | Cost & abuse hardening on `register-translation-strings` (rate limit per IP, daily cap on `translate-strings`) | 2 | S | 🟢 Low |

### Suggested execution order
**Phase 1 (quick wins, 1–2 days):** K1 → K2 → K3 → K4 → K10  
**Phase 2 (substance, 2–3 days):** K5 → K6 → K7 → K9 → K12  
**Phase 3 (deep refactor, 3+ days, separate approval):** K8 → K11

---

## 11. What I Will NOT Do Without Approval

- No refactor of existing notification/email storage schemas (Batch K8 is destructive-ish).
- No removal of any current English text or component.
- No changes to OpenAPI spec, Developer Portal public routes (Standing Orders honored).
- No changes to `package.json` or addition of `i18next`/`react-intl` — current home-grown stack is sufficient and already at 100% DB coverage.

---

## 12. Per-Batch Approval Checklist (template)

```
Batch K_:
  [ ] Files listed and reviewed
  [ ] No protected routes affected
  [ ] No schema changes (or migration drafted separately)
  [ ] Smoke test plan documented
  [ ] Rollback plan: revert PR
  [ ] Approved by: __________
```

---

**End of audit.** Pick the batches you want me to execute and I'll proceed one at a time, ≤10 files per batch, each with verification.
