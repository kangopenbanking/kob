
-- Phase 2: Payout Rails Configuration + Speed Support

-- 1. Create payout_rails configuration table
CREATE TABLE public.payout_rails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rail_code TEXT NOT NULL UNIQUE,
  rail_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  channel TEXT NOT NULL,
  destination_type TEXT NOT NULL, -- 'card', 'bank', 'momo', 'paypal'
  speed TEXT NOT NULL DEFAULT 'standard', -- 'instant', 'standard'
  estimated_time_seconds INTEGER, -- estimated delivery time
  is_active BOOLEAN NOT NULL DEFAULT true,
  supported_currencies TEXT[] NOT NULL DEFAULT ARRAY['XAF'],
  supported_countries TEXT[] NOT NULL DEFAULT ARRAY['CM'],
  min_amount NUMERIC NOT NULL DEFAULT 100,
  max_amount NUMERIC NOT NULL DEFAULT 10000000,
  fee_fixed NUMERIC NOT NULL DEFAULT 0,
  fee_percentage NUMERIC NOT NULL DEFAULT 0,
  fee_currency TEXT NOT NULL DEFAULT 'XAF',
  operating_hours JSONB DEFAULT '{"24x7": false, "start": "08:00", "end": "17:00", "timezone": "Africa/Douala"}'::jsonb,
  requires_prefunding BOOLEAN NOT NULL DEFAULT false,
  risk_tier TEXT NOT NULL DEFAULT 'standard', -- 'low', 'standard', 'high'
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add speed and rail columns to gateway_payouts
ALTER TABLE public.gateway_payouts
  ADD COLUMN IF NOT EXISTS speed TEXT DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS rail_id UUID REFERENCES public.payout_rails(id),
  ADD COLUMN IF NOT EXISTS estimated_arrival_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS compliance_check_id UUID;

-- 3. Create treasury_float table for prefunding/liquidity management (Phase 3 prep)
CREATE TABLE public.treasury_float (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rail_id UUID NOT NULL REFERENCES public.payout_rails(id),
  currency TEXT NOT NULL DEFAULT 'XAF',
  available_balance NUMERIC NOT NULL DEFAULT 0,
  reserved_balance NUMERIC NOT NULL DEFAULT 0,
  total_funded NUMERIC NOT NULL DEFAULT 0,
  total_disbursed NUMERIC NOT NULL DEFAULT 0,
  low_balance_threshold NUMERIC NOT NULL DEFAULT 1000000,
  auto_replenish BOOLEAN NOT NULL DEFAULT false,
  last_replenished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(rail_id, currency)
);

-- 4. Create push_to_card_transactions for Visa Direct audit trail
CREATE TABLE public.push_to_card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID REFERENCES public.gateway_payouts(id),
  merchant_id UUID REFERENCES public.gateway_merchants(id),
  user_id UUID,
  card_token TEXT, -- tokenized, never raw PAN
  card_last4 TEXT,
  card_network TEXT, -- 'visa', 'mastercard'
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  speed TEXT NOT NULL DEFAULT 'instant',
  provider TEXT NOT NULL, -- 'visa_direct', 'mastercard_send', 'stripe_instant'
  provider_ref TEXT,
  provider_raw JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  risk_score INTEGER,
  compliance_decision TEXT, -- 'approve', 'review', 'deny'
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Enable RLS on all new tables
ALTER TABLE public.payout_rails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treasury_float ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_to_card_transactions ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies: payout_rails is public-read, admin-write
CREATE POLICY "Anyone can read active payout rails"
  ON public.payout_rails FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage payout rails"
  ON public.payout_rails FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7. RLS Policies: treasury_float is admin-only
CREATE POLICY "Admins can manage treasury float"
  ON public.treasury_float FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 8. RLS Policies: push_to_card_transactions
CREATE POLICY "Merchants can view their push-to-card txns"
  ON public.push_to_card_transactions FOR SELECT
  TO authenticated
  USING (
    merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid())
    OR user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Service role can insert push-to-card txns"
  ON public.push_to_card_transactions FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update push-to-card txns"
  ON public.push_to_card_transactions FOR UPDATE
  TO service_role
  USING (true);

-- 9. Seed default payout rails
INSERT INTO public.payout_rails (rail_code, rail_name, provider, channel, destination_type, speed, estimated_time_seconds, supported_currencies, supported_countries, min_amount, max_amount, fee_fixed, fee_percentage, operating_hours, requires_prefunding, risk_tier) VALUES
  ('flw_momo', 'Mobile Money (Flutterwave)', 'flutterwave', 'mobilemoney', 'momo', 'standard', 300, ARRAY['XAF','XOF','NGN','GHS','KES','UGX','TZS','RWF'], ARRAY['CM','SN','NG','GH','KE','UG','TZ','RW'], 100, 5000000, 0, 1.5, '{"24x7": true}'::jsonb, false, 'standard'),
  ('flw_bank', 'Bank Transfer (Flutterwave)', 'flutterwave', 'bank', 'bank', 'standard', 86400, ARRAY['XAF','XOF','NGN','GHS','KES'], ARRAY['CM','SN','NG','GH','KE'], 1000, 50000000, 250, 0.5, '{"24x7": false, "start": "08:00", "end": "17:00", "timezone": "Africa/Douala"}'::jsonb, false, 'standard'),
  ('stripe_card', 'Card Refund (Stripe)', 'stripe', 'card', 'card', 'standard', 432000, ARRAY['XAF','USD','EUR','GBP'], ARRAY['CM','US','GB','FR','DE'], 500, 10000000, 0, 2.5, '{"24x7": true}'::jsonb, false, 'standard'),
  ('paypal_payout', 'PayPal Payout', 'paypal', 'paypal', 'paypal', 'standard', 3600, ARRAY['USD','EUR','GBP'], ARRAY['US','GB','FR','DE','CM'], 100, 50000000, 0, 2.0, '{"24x7": true}'::jsonb, false, 'low'),
  ('visa_direct', 'Visa Direct Push-to-Card', 'visa_direct', 'card_push', 'card', 'instant', 30, ARRAY['XAF','USD','EUR','GBP'], ARRAY['CM','US','GB','FR','DE'], 500, 5000000, 500, 1.0, '{"24x7": true}'::jsonb, true, 'high'),
  ('mc_send', 'Mastercard Send', 'mastercard_send', 'card_push', 'card', 'instant', 30, ARRAY['XAF','USD','EUR','GBP'], ARRAY['CM','US','GB','FR','DE'], 500, 5000000, 500, 1.0, '{"24x7": true}'::jsonb, true, 'high'),
  ('cemac_rtgs', 'CEMAC RTGS/SYSTAC', 'cemac', 'bank_push', 'bank', 'instant', 60, ARRAY['XAF'], ARRAY['CM','GA','CG','TD','CF','GQ'], 10000, 100000000, 1000, 0.1, '{"24x7": false, "start": "07:00", "end": "16:00", "timezone": "Africa/Douala"}'::jsonb, true, 'high');

-- 10. Seed treasury float for instant rails
INSERT INTO public.treasury_float (rail_id, currency, available_balance, low_balance_threshold)
SELECT id, 'XAF', 0, 5000000 FROM public.payout_rails WHERE requires_prefunding = true;

-- 11. Update trigger for payout_rails
CREATE TRIGGER update_payout_rails_updated_at
  BEFORE UPDATE ON public.payout_rails
  FOR EACH ROW EXECUTE FUNCTION public.update_settlement_updated_at();

CREATE TRIGGER update_treasury_float_updated_at
  BEFORE UPDATE ON public.treasury_float
  FOR EACH ROW EXECUTE FUNCTION public.update_settlement_updated_at();

CREATE TRIGGER update_push_to_card_updated_at
  BEFORE UPDATE ON public.push_to_card_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_settlement_updated_at();
