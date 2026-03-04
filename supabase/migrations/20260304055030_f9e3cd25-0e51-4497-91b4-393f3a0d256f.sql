-- Add institution_id to kyc_verifications for separation
ALTER TABLE public.kyc_verifications
ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL;

-- Add source_app column to identify origin (customer_app vs banking_app)
ALTER TABLE public.kyc_verifications
ADD COLUMN IF NOT EXISTS source_app text DEFAULT 'customer_app';

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_institution ON public.kyc_verifications(institution_id);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_source ON public.kyc_verifications(source_app);