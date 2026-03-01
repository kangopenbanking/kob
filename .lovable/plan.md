

# Plan: Linked Account Security — 2-Account Limit, Funding Restriction, Admin-Approved Re-linking

## Summary

Three security enhancements to the Customer App linked accounts system:
1. **2-account hard limit** — users can link at most 2 accounts
2. **Funding restricted to linked accounts only** — the Fund Wallet page must require selecting a linked account as the funding source
3. **Admin approval for re-linking after deletion** — when a user removes an account, any new account addition requires admin approval before activation

---

## Phase 1: Database — Linked Account Removal Requests Table

Create a new `linked_account_change_requests` table to track admin approval workflow:

```sql
CREATE TABLE public.linked_account_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL DEFAULT 'add_after_removal', -- e.g. add_after_removal
  requested_account_data JSONB NOT NULL, -- the account details user wants to add
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  reviewed_by UUID REFERENCES auth.users(id),
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE linked_account_change_requests ENABLE ROW LEVEL SECURITY;

-- Users can see their own requests
CREATE POLICY "Users view own requests" ON linked_account_change_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Users can insert their own requests
CREATE POLICY "Users create own requests" ON linked_account_change_requests
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Admins can view/update all
CREATE POLICY "Admins manage all requests" ON linked_account_change_requests
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
```

Also add a column to `customer_linked_accounts` to track removal history:

```sql
ALTER TABLE customer_linked_accounts
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_removals INTEGER DEFAULT 0;
```

---

## Phase 2: Customer App — Enforce 2-Account Limit

**File**: `src/pages/customer-app/CustomerLinkedAccounts.tsx`

- Before showing the "Add" dialog, check `linkedAccounts.length >= 2` — if so, show a toast/banner: "Maximum 2 linked accounts reached"
- Disable the `+` button when at limit
- Also check if user has **any previously removed accounts** (`status = 'removed'`). If yes, new additions go through the approval workflow instead of direct insert

---

## Phase 3: Customer App — Admin Approval Workflow for Re-linking

**File**: `src/pages/customer-app/CustomerLinkedAccounts.tsx`

When user has removed an account previously:
- `handleAddAccount` submits to `linked_account_change_requests` table instead of directly inserting into `customer_linked_accounts`
- Show a "Pending Approval" badge on the UI for requests awaiting admin review
- Add a section showing pending requests with status indicators

---

## Phase 4: Admin Portal — Manage Linked Account Requests

**File**: New component in admin portal (e.g., `src/pages/admin/LinkedAccountRequests.tsx`)

- List all pending `linked_account_change_requests` with user profile info
- Admin can approve (which inserts the account into `customer_linked_accounts`) or reject with notes
- Add navigation entry in admin sidebar under an appropriate section

---

## Phase 5: Fund Wallet — Restrict to Linked Accounts Only

**File**: `src/pages/customer-app/CustomerFundWallet.tsx`

Currently the Fund Wallet page lets users pick any payment method freely. Changes:
- Fetch user's active linked accounts
- Replace the generic payment method selector with a **linked account selector** — users pick which of their linked accounts to fund from
- The payment method (`mobile_money`, `card`, `bank_transfer`, `paypal`) is derived from the selected linked account's `provider_type`
- If user has 0 linked accounts, show a prompt to link one first (with a link to `/app/linked-accounts`)
- Pass the linked account reference in the funding intent for audit

---

## Phase 6: Customer Onboarding Update

**File**: `src/pages/customer-app/CustomerOnboarding.tsx`

- During onboarding, if a user links an account, this counts toward the 2-account limit
- No changes needed to the approval flow since first-time links don't require approval

---

## Files Created
- `src/pages/admin/LinkedAccountRequests.tsx` — admin approval UI
- DB migration for `linked_account_change_requests` table + `customer_linked_accounts` columns

## Files Modified
- `src/pages/customer-app/CustomerLinkedAccounts.tsx` — 2-account limit, approval workflow
- `src/pages/customer-app/CustomerFundWallet.tsx` — restrict funding to linked accounts
- Admin navigation config (add link to new requests page)

