
-- Add DOMESTIC_RIB to the account_scheme enum
ALTER TYPE account_scheme ADD VALUE IF NOT EXISTS 'DOMESTIC_RIB';

-- Add structured RIB columns to accounts table (all nullable, no impact on existing rows)
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS rib_bank_code VARCHAR(5),
  ADD COLUMN IF NOT EXISTS rib_branch_code VARCHAR(5),
  ADD COLUMN IF NOT EXISTS rib_account_number VARCHAR(11),
  ADD COLUMN IF NOT EXISTS rib_key VARCHAR(2),
  ADD COLUMN IF NOT EXISTS swift_bic VARCHAR(11),
  ADD COLUMN IF NOT EXISTS account_country CHAR(2) DEFAULT 'CM';
