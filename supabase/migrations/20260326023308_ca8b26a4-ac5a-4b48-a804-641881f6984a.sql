
CREATE TABLE public.recurring_payment_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_payment_id UUID NOT NULL REFERENCES public.recurring_payments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_type TEXT,
  payment_ref TEXT,
  error_message TEXT,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_payment_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own executions"
  ON public.recurring_payment_executions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can insert executions"
  ON public.recurring_payment_executions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_recurring_payment_executions_payment ON public.recurring_payment_executions(recurring_payment_id);
CREATE INDEX idx_recurring_payment_executions_user ON public.recurring_payment_executions(user_id);
