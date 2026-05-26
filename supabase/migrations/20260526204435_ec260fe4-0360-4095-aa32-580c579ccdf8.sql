
ALTER TABLE public.pay_by_bank_intents
  ALTER COLUMN merchant_id DROP NOT NULL;

ALTER TABLE public.pay_by_bank_intents
  ADD COLUMN IF NOT EXISTS target_type text NOT NULL DEFAULT 'merchant',
  ADD COLUMN IF NOT EXISTS target_account_id uuid NULL;

ALTER TABLE public.pay_by_bank_intents
  DROP CONSTRAINT IF EXISTS pay_by_bank_intents_target_type_check;
ALTER TABLE public.pay_by_bank_intents
  ADD CONSTRAINT pay_by_bank_intents_target_type_check
  CHECK (target_type IN ('merchant', 'consumer_wallet'));

ALTER TABLE public.pay_by_bank_intents
  DROP CONSTRAINT IF EXISTS pay_by_bank_intents_target_presence_check;
ALTER TABLE public.pay_by_bank_intents
  ADD CONSTRAINT pay_by_bank_intents_target_presence_check
  CHECK (
    (target_type = 'merchant' AND merchant_id IS NOT NULL)
    OR (target_type = 'consumer_wallet' AND target_account_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_pay_by_bank_intents_target_account
  ON public.pay_by_bank_intents(target_account_id)
  WHERE target_account_id IS NOT NULL;
