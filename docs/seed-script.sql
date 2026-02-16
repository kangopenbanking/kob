-- ============================================
-- KOB Seed Script — Demo/Test Data
-- Run this against the TEST environment only
-- ============================================

-- Note: This script assumes a test user and institution already exist.
-- Replace the UUIDs below with actual IDs from your test environment.

-- Placeholder IDs (replace with real values)
-- TEST_USER_ID: use an actual auth.users UUID
-- TEST_INSTITUTION_ID: use an actual institutions UUID

-- ============================================
-- 1. Ledger: Chart of Accounts
-- ============================================
INSERT INTO public.ledger_accounts (account_code, account_name, account_type, currency, description) VALUES
  ('1000', 'Cash & Bank', 'asset', 'XAF', 'Cash and bank balances'),
  ('1100', 'Loan Receivables', 'asset', 'XAF', 'Outstanding loan principal'),
  ('1200', 'Interest Receivable', 'asset', 'XAF', 'Accrued interest on loans'),
  ('2000', 'Customer Deposits', 'liability', 'XAF', 'Savings account liabilities'),
  ('2100', 'Interest Payable', 'liability', 'XAF', 'Accrued interest on savings'),
  ('2200', 'Fees Collected', 'liability', 'XAF', 'Collected fees pending settlement'),
  ('3000', 'Equity', 'equity', 'XAF', 'Owners equity'),
  ('4000', 'Interest Income', 'revenue', 'XAF', 'Interest earned on loans'),
  ('4100', 'Fee Income', 'revenue', 'XAF', 'Transaction and processing fees'),
  ('4200', 'Commission Income', 'revenue', 'XAF', 'Mobile money and transfer commissions'),
  ('5000', 'Interest Expense', 'expense', 'XAF', 'Interest paid on savings'),
  ('5100', 'Processing Costs', 'expense', 'XAF', 'Payment rail processing costs'),
  ('5200', 'Bad Debt Expense', 'expense', 'XAF', 'Loan write-offs')
ON CONFLICT (account_code) DO NOTHING;

-- ============================================
-- 2. Sample Loan Products (if not already seeded)
-- ============================================
-- These may already exist from prior migrations; ON CONFLICT prevents errors.

-- ============================================
-- 3. Sample Savings Products (if not already seeded)
-- ============================================
-- These may already exist from prior migrations; ON CONFLICT prevents errors.

-- ============================================
-- Usage Instructions
-- ============================================
-- 1. Create a test user via the auth signup flow
-- 2. Note the user's UUID from profiles table
-- 3. Create a test institution via the institution registration flow
-- 4. Run this script to populate ledger chart of accounts
-- 5. Use the API endpoints to create loans, savings accounts, payments, etc.
--
-- For a complete end-to-end test:
-- a) POST /v1/oauth/token → get access token
-- b) POST /v1/savings/create → create savings account
-- c) POST /v1/savings/deposit → make deposit (will create journal entries)
-- d) POST /v1/loans/apply → apply for loan
-- e) POST /v1/loans/approve → admin approves
-- f) POST /v1/loans/disburse → disburse (creates schedule + journal entries)
-- g) POST /v1/loans/repay → make repayment
