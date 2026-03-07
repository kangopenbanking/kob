
-- Create fee_limits_charges table
CREATE TABLE public.fee_limits_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL UNIQUE,
  percentage_charge numeric NOT NULL DEFAULT 0,
  fixed_charge numeric NOT NULL DEFAULT 0,
  min_amount numeric NOT NULL DEFAULT 0,
  max_amount numeric NOT NULL DEFAULT 0,
  daily_limit numeric NOT NULL DEFAULT -1,
  monthly_limit numeric NOT NULL DEFAULT -1,
  daily_request_accept_limit numeric NOT NULL DEFAULT -1,
  monthly_request_accept_limit numeric NOT NULL DEFAULT -1,
  max_charge_cap numeric NOT NULL DEFAULT -1,
  agent_commission_fixed numeric NOT NULL DEFAULT 0,
  agent_commission_percent numeric NOT NULL DEFAULT 0,
  referral_percent_commission numeric NOT NULL DEFAULT 0,
  referral_fixed_commission numeric NOT NULL DEFAULT 0,
  merchant_percent_charge numeric NOT NULL DEFAULT 0,
  merchant_fixed_charge numeric NOT NULL DEFAULT 0,
  user_percent_charge numeric NOT NULL DEFAULT 0,
  user_fixed_charge numeric NOT NULL DEFAULT 0,
  daily_count_limit integer NOT NULL DEFAULT -1,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Enable RLS
ALTER TABLE public.fee_limits_charges ENABLE ROW LEVEL SECURITY;

-- Read for authenticated users
CREATE POLICY "Authenticated users can read fee_limits_charges"
  ON public.fee_limits_charges FOR SELECT TO authenticated USING (true);

-- Write restricted to admins
CREATE POLICY "Admins can insert fee_limits_charges"
  ON public.fee_limits_charges FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update fee_limits_charges"
  ON public.fee_limits_charges FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete fee_limits_charges"
  ON public.fee_limits_charges FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed 8 default categories
INSERT INTO public.fee_limits_charges (category) VALUES
  ('send_money'),
  ('cash_in'),
  ('cash_out'),
  ('mobile_recharge'),
  ('bank_transfer'),
  ('payment_charges'),
  ('invoice_create'),
  ('api_payment');
