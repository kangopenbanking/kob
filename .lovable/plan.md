

## Plan: Bank Savings → Explore Savings Products from Financial Institutions

### Changes

1. **Update `CategoryCard` button text** in `CustomerPiggyBank.tsx`
   - Change "Start Saving" to "Explore Now" only for the Bank Savings card (pass a `buttonLabel` prop)

2. **Add new view mode `'explore'`** to `CustomerPiggyBank.tsx`
   - When user clicks Bank Savings "Explore Now", navigate to `view = 'explore'` instead of `'list'`
   - The `'explore'` view fetches `savings_products` joined with `institutions` (to get institution name) where `is_active = true`
   - Groups products by institution and displays them in a modern UI:
     - Institution header (name, type badge)
     - Horizontally scrollable or stacked product cards showing: product name, interest rate, min opening balance, savings type, lock-in period
     - "Apply" button on each card that opens the `CreateSavingsForm` dialog (already exists) pre-filled with that product

3. **Fetch savings products with institution data**
   - Add a React Query hook in the component (or `useCustomerData.ts`) that queries `savings_products` joined with `institutions(institution_name)` where `is_active = true`
   - RLS: `savings_products` likely needs a SELECT policy for authenticated users (will check and add migration if needed)

4. **Apply flow**
   - Clicking "Apply" on a product card opens the existing `CreateSavingsForm` component (from `src/components/savings/CreateSavingsForm.tsx`) with the product pre-selected
   - Reuse the existing `savings-create` edge function for account creation

### Files Modified
- `src/pages/customer-app/CustomerPiggyBank.tsx` — add `explore` view, update button text, fetch & display savings products grouped by institution
- Possible migration for RLS on `savings_products` table (SELECT for authenticated users)

