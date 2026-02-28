

## Analysis: Banking vs Customer App Management Field Mismatches

After reviewing both management pages, the actual apps, and their respective tenant providers, here are the issues found:

### Problems in Banking App Management (`BankingAppManagement.tsx`)

**1. Piggy Bank & Njangi tabs should NOT be in the Banking App Management**
- The Banking App's `TenantProvider` (`AppFeatures`) only defines: `cards`, `savings`, `loans`, `credit_score`, `mobile_money`, `qr_payments`, `bill_payments`
- Piggy Bank and Njangi are Customer App features (defined in `CustomerAppFeatures` in `CustomerTenantProvider.tsx`)
- Even though the Banking App's "More" page (BankMore.tsx) links to piggy bank and njangi routes, those are shared services -- the **admin management** view should only show features native to that app's config model
- The Banking App Management currently fetches and displays: Piggy Bank Plans tab, Njangi Groups tab, Piggy Bank stat card, Njangi stat card
- These should be **removed** from Banking App Management since they belong in Customer App Management (which already has them)

**2. `account_funding` feature toggle exists in Banking Management but not in `AppFeatures` type**
- The `featureLabels` map lists `account_funding: "Account Funding"` but the actual `AppFeatures` interface in TenantProvider doesn't include it
- This is a phantom toggle that does nothing

**3. Preview bottom nav shows emoji** (minor)
- Line 1158: `"Good afternoon 👋"` -- uses emoji, should be removed per design standards

### Problems in Customer App Management (`CustomerAppManagement.tsx`)

**4. Customer App sections are missing from the section order**
- `CustomerTenantProvider` defines sections: `balance_card`, `quick_actions`, `media_banner`, `upcoming_bills`, `spending_stats`, `recent_activities`
- But the Customer App Management only allows ordering: `balance_card`, `quick_actions`, `media_banner`, `recent_activities`
- Missing: `upcoming_bills` and `spending_stats` from the reorderable section list

### Implementation Plan

**Step 1: Clean Banking App Management**
- Remove `useInstitutionPiggyBankPlans` and `useInstitutionNjangiGroups` hooks and their usage
- Remove Piggy Bank and Njangi tab triggers and tab content
- Remove Piggy Bank and Njangi stat cards
- Remove `account_funding` from the feature toggle list (or add it to the actual AppFeatures type if intended)
- Replace emoji in preview greeting

**Step 2: Fix Customer App Management section order**
- Add `upcoming_bills` and `spending_stats` to `CustomerSectionKey` type and `sectionLabels` map
- Add these to `defaultSectionOrder`
- Add preview rendering for these sections

**Step 3: Verify consistency**
- Ensure Banking features config only shows toggles that exist in the `AppFeatures` interface
- Ensure Customer features config matches `CustomerAppFeatures` interface

### Files to modify:
- `src/pages/admin/BankingAppManagement.tsx` -- Remove Piggy Bank, Njangi tabs/stats/hooks; fix feature labels; remove emoji
- `src/pages/admin/CustomerAppManagement.tsx` -- Add missing section keys (`upcoming_bills`, `spending_stats`)

