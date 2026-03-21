
ALTER TABLE public.remittances ADD COLUMN IF NOT EXISTS sender_user_id UUID;

-- Create RPC for atomic usage tracking increment
CREATE OR REPLACE FUNCTION public.increment_remittance_usage(
  _user_id UUID,
  _corridor_id UUID,
  _period_type TEXT,
  _period_start DATE,
  _amount NUMERIC,
  _currency TEXT DEFAULT 'XAF'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO remittance_usage_tracking (user_id, corridor_id, period_type, period_start, total_amount, transaction_count, currency)
  VALUES (_user_id, _corridor_id, _period_type, _period_start, _amount, 1, _currency)
  ON CONFLICT (user_id, corridor_id, period_type, period_start)
  DO UPDATE SET
    total_amount = remittance_usage_tracking.total_amount + _amount,
    transaction_count = remittance_usage_tracking.transaction_count + 1;
END;
$$;
