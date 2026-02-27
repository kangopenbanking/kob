
-- Add multi-consumer funding scope columns to funding_intents
ALTER TABLE public.funding_intents 
  ADD COLUMN IF NOT EXISTS funding_scope text NOT NULL DEFAULT 'end_user',
  ADD COLUMN IF NOT EXISTS merchant_id uuid REFERENCES public.gateway_merchants(id),
  ADD COLUMN IF NOT EXISTS api_client_id text,
  ADD COLUMN IF NOT EXISTS target_description text;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_funding_intents_funding_scope ON public.funding_intents(funding_scope);
CREATE INDEX IF NOT EXISTS idx_funding_intents_merchant_id ON public.funding_intents(merchant_id);

-- RLS: Merchants can read their own funding intents
CREATE POLICY "merchants_read_own_funding_intents" ON public.funding_intents
  FOR SELECT USING (
    funding_scope = 'merchant' 
    AND merchant_id IN (
      SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid()
    )
  );

-- RLS: Merchants can insert funding intents for their merchant
CREATE POLICY "merchants_insert_own_funding_intents" ON public.funding_intents
  FOR INSERT WITH CHECK (
    funding_scope = 'merchant'
    AND merchant_id IN (
      SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid()
    )
  );

-- RLS: Institution owners/staff can read institution-scoped funding intents
CREATE POLICY "institution_read_funding_intents" ON public.funding_intents
  FOR SELECT USING (
    funding_scope IN ('institution', 'external_api')
    AND institution_id IN (
      SELECT id FROM public.institutions WHERE user_id = auth.uid()
      UNION
      SELECT institution_id FROM public.staff_assignments WHERE user_id = auth.uid() AND is_active = true
    )
  );
