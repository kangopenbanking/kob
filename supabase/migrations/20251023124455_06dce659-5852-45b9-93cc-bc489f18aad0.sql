-- Add columns to mobile_money_transactions for bank deposits
ALTER TABLE mobile_money_transactions
ADD COLUMN IF NOT EXISTS destination_account_id uuid REFERENCES accounts(id),
ADD COLUMN IF NOT EXISTS bank_transaction_id uuid REFERENCES transactions(id),
ADD COLUMN IF NOT EXISTS is_bank_deposit boolean DEFAULT false;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_mobile_money_bank_deposits 
ON mobile_money_transactions(destination_account_id, is_bank_deposit) 
WHERE is_bank_deposit = true;

-- Drop existing policy if it exists and recreate
DROP POLICY IF EXISTS "Users can view own bank deposits via mobile money" ON mobile_money_transactions;

CREATE POLICY "Users can view own bank deposits via mobile money"
ON mobile_money_transactions
FOR SELECT
USING (
  auth.uid() = user_id OR
  destination_account_id IN (
    SELECT id FROM accounts WHERE user_id = auth.uid()
  )
);