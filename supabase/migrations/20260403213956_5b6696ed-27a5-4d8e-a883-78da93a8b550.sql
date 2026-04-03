
-- Trust Score Engine table
CREATE TABLE public.merchant_trust_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL DEFAULT 0,
  verification_score INTEGER NOT NULL DEFAULT 0,
  transaction_score INTEGER NOT NULL DEFAULT 0,
  failure_rate_score INTEGER NOT NULL DEFAULT 0,
  dispute_score INTEGER NOT NULL DEFAULT 0,
  score_breakdown JSONB DEFAULT '{}',
  risk_level TEXT NOT NULL DEFAULT 'medium',
  last_calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(merchant_id)
);

ALTER TABLE public.merchant_trust_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all trust scores"
ON public.merchant_trust_scores FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Merchants can view own trust score"
ON public.merchant_trust_scores FOR SELECT
TO authenticated
USING (
  merchant_id IN (
    SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid()
  )
);

-- Business Verification Checks table
CREATE TABLE public.business_verification_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_kyc_id UUID NOT NULL REFERENCES public.business_kyc(id) ON DELETE CASCADE,
  check_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  extracted_data JSONB DEFAULT '{}',
  cross_check_result JSONB DEFAULT '{}',
  confidence_score NUMERIC(5,2) DEFAULT 0,
  reviewed_by UUID,
  review_notes TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.business_verification_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all verification checks"
ON public.business_verification_checks FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own verification checks"
ON public.business_verification_checks FOR SELECT
TO authenticated
USING (
  business_kyc_id IN (
    SELECT id FROM public.business_kyc WHERE user_id = auth.uid()
  )
);

-- Indexes
CREATE INDEX idx_trust_scores_merchant ON public.merchant_trust_scores(merchant_id);
CREATE INDEX idx_trust_scores_risk ON public.merchant_trust_scores(risk_level);
CREATE INDEX idx_verification_checks_kyc ON public.business_verification_checks(business_kyc_id);
CREATE INDEX idx_verification_checks_status ON public.business_verification_checks(status);

-- Trigger for updated_at
CREATE TRIGGER update_merchant_trust_scores_updated_at
BEFORE UPDATE ON public.merchant_trust_scores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_business_verification_checks_updated_at
BEFORE UPDATE ON public.business_verification_checks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
