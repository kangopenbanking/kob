
-- Customer invoices table for the Consumer App
CREATE TABLE public.customer_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'XAF',
  status TEXT NOT NULL DEFAULT 'pending',
  due_date DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_invoices ENABLE ROW LEVEL SECURITY;

-- Users can only see their own invoices
CREATE POLICY "Users can view own invoices" ON public.customer_invoices
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can create own invoices" ON public.customer_invoices
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own invoices" ON public.customer_invoices
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Sequence for invoice numbers
CREATE SEQUENCE IF NOT EXISTS customer_invoice_seq START 1;

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION public.update_customer_invoice_timestamp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_customer_invoices_updated_at
  BEFORE UPDATE ON public.customer_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_customer_invoice_timestamp();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_invoices;
