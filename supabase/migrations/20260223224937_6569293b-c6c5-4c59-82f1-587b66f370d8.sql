
-- GAP 3: Merchant Settlement Accounts
CREATE TABLE public.gateway_merchant_settlement_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL DEFAULT 'bank_transfer',
  bank_code TEXT,
  bank_name TEXT,
  account_number TEXT NOT NULL,
  account_name TEXT,
  phone_number TEXT,
  currency TEXT NOT NULL DEFAULT 'XAF',
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gateway_merchant_settlement_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_settlement_accts" ON public.gateway_merchant_settlement_accounts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.gateway_merchants gm WHERE gm.id = merchant_id AND gm.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ins_settlement_accts" ON public.gateway_merchant_settlement_accounts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.gateway_merchants gm WHERE gm.id = merchant_id AND gm.user_id = auth.uid()));
CREATE POLICY "upd_settlement_accts" ON public.gateway_merchant_settlement_accounts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.gateway_merchants gm WHERE gm.id = merchant_id AND gm.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "del_settlement_accts" ON public.gateway_merchant_settlement_accounts FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.gateway_merchants gm WHERE gm.id = merchant_id AND gm.user_id = auth.uid()));
CREATE POLICY "svc_settlement_accts" ON public.gateway_merchant_settlement_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- GAP 4: Per-Merchant Multiple Webhook Endpoints
CREATE TABLE public.gateway_merchant_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  label TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gateway_merchant_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_merch_webhooks" ON public.gateway_merchant_webhooks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.gateway_merchants gm WHERE gm.id = merchant_id AND gm.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ins_merch_webhooks" ON public.gateway_merchant_webhooks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.gateway_merchants gm WHERE gm.id = merchant_id AND gm.user_id = auth.uid()));
CREATE POLICY "upd_merch_webhooks" ON public.gateway_merchant_webhooks FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.gateway_merchants gm WHERE gm.id = merchant_id AND gm.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "del_merch_webhooks" ON public.gateway_merchant_webhooks FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.gateway_merchants gm WHERE gm.id = merchant_id AND gm.user_id = auth.uid()));
CREATE POLICY "svc_merch_webhooks" ON public.gateway_merchant_webhooks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Webhook deliveries
CREATE TABLE public.gateway_webhook_deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id),
  webhook_id UUID REFERENCES public.gateway_merchant_webhooks(id),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  response_code INTEGER,
  response_body_snippet TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gateway_webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_wh_deliveries" ON public.gateway_webhook_deliveries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.gateway_merchants gm WHERE gm.id = merchant_id AND gm.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "svc_wh_deliveries" ON public.gateway_webhook_deliveries FOR ALL TO service_role USING (true) WITH CHECK (true);

-- GAP 5: Reconciliation Framework
CREATE TABLE public.gateway_reconciliation_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID REFERENCES public.gateway_merchants(id),
  provider TEXT,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  total_internal INTEGER DEFAULT 0,
  total_provider INTEGER DEFAULT 0,
  matched INTEGER DEFAULT 0,
  mismatched INTEGER DEFAULT 0,
  summary JSONB DEFAULT '{}',
  initiated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gateway_reconciliation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_recon_runs" ON public.gateway_reconciliation_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR (merchant_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.gateway_merchants gm WHERE gm.id = merchant_id AND gm.user_id = auth.uid())));
CREATE POLICY "svc_recon_runs" ON public.gateway_reconciliation_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.gateway_reconciliation_mismatches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.gateway_reconciliation_runs(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL,
  object_id UUID NOT NULL,
  mismatch_type TEXT NOT NULL,
  internal_value TEXT,
  provider_value TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  resolution_notes TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gateway_reconciliation_mismatches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_recon_mismatches" ON public.gateway_reconciliation_mismatches FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.gateway_reconciliation_runs r JOIN public.gateway_merchants gm ON gm.id = r.merchant_id WHERE r.id = run_id AND gm.user_id = auth.uid()));
CREATE POLICY "svc_recon_mismatches" ON public.gateway_reconciliation_mismatches FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_gw_sa_merchant ON public.gateway_merchant_settlement_accounts(merchant_id);
CREATE INDEX idx_gw_mw_merchant ON public.gateway_merchant_webhooks(merchant_id);
CREATE INDEX idx_gw_wd_merchant ON public.gateway_webhook_deliveries(merchant_id);
CREATE INDEX idx_gw_wd_webhook ON public.gateway_webhook_deliveries(webhook_id);
CREATE INDEX idx_gw_wd_pending ON public.gateway_webhook_deliveries(status) WHERE status = 'pending';
CREATE INDEX idx_gw_rr_merchant ON public.gateway_reconciliation_runs(merchant_id);
CREATE INDEX idx_gw_rm_run ON public.gateway_reconciliation_mismatches(run_id);
CREATE INDEX idx_gw_rm_open ON public.gateway_reconciliation_mismatches(status) WHERE status = 'open';
