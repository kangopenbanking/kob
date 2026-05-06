ALTER TABLE public.gateway_merchants
  ADD COLUMN IF NOT EXISTS kyb_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS kyb_rejection_reason text,
  ADD COLUMN IF NOT EXISTS kyb_documents jsonb;