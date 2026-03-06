
-- Customer rewards table for tracking cashback, referral bonuses, and coupon redemptions
CREATE TABLE public.customer_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  reward_type TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'XAF',
  status TEXT NOT NULL DEFAULT 'credited',
  description TEXT,
  reference_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rewards"
ON public.customer_rewards FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE INDEX idx_customer_rewards_user_id ON public.customer_rewards(user_id);
CREATE INDEX idx_customer_rewards_type ON public.customer_rewards(reward_type);

-- Referral tracking table
CREATE TABLE public.customer_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  referred_id UUID NOT NULL,
  referral_code TEXT NOT NULL,
  bonus_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(referred_id)
);

ALTER TABLE public.customer_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals"
ON public.customer_referrals FOR SELECT
TO authenticated
USING (referrer_id = auth.uid() OR referred_id = auth.uid());

CREATE INDEX idx_customer_referrals_referrer ON public.customer_referrals(referrer_id);
CREATE INDEX idx_customer_referrals_code ON public.customer_referrals(referral_code);
