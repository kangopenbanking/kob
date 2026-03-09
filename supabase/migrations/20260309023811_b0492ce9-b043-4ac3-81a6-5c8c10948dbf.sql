
-- POS Shift Management tables
CREATE TABLE public.pos_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  cashier_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  opening_cash NUMERIC NOT NULL DEFAULT 0,
  closing_cash NUMERIC,
  expected_cash NUMERIC,
  cash_difference NUMERIC,
  total_sales NUMERIC DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  total_refunds NUMERIC DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.pos_cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES public.pos_shifts(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'cash_in', 'cash_out', 'sale', 'refund'
  amount NUMERIC NOT NULL,
  reason TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.pos_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage own shifts" ON public.pos_shifts
  FOR ALL TO authenticated
  USING (
    merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid())
    OR cashier_id = auth.uid()
  );

CREATE POLICY "Merchants manage own cash movements" ON public.pos_cash_movements
  FOR ALL TO authenticated
  USING (
    merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid())
    OR created_by = auth.uid()
  );
