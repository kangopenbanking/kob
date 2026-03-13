
CREATE TABLE public.credit_report_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'XAF',
  status text NOT NULL DEFAULT 'pending',
  payment_method text,
  report_type text NOT NULL DEFAULT 'full',
  purchased_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.credit_report_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own purchases" ON public.credit_report_purchases
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users insert own purchases" ON public.credit_report_purchases
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
