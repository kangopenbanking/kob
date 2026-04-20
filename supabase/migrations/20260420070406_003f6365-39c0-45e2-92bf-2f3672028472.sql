
-- 1. Merchant QR codes (stable per-merchant + optional dynamic per-order/amount)
CREATE TABLE IF NOT EXISTS public.merchant_qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,                         -- short public identifier, e.g. 'mama-resto-9k2x'
  qr_type TEXT NOT NULL DEFAULT 'static' CHECK (qr_type IN ('static','dynamic')),
  amount NUMERIC(20,4),                              -- NULL for static (any amount)
  currency TEXT NOT NULL DEFAULT 'XAF',
  description TEXT,
  order_id UUID,                                     -- only for dynamic, single-use
  signing_secret TEXT NOT NULL,                      -- 32-byte hex, used to HMAC payloads
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,                            -- NULL = never expires
  scan_count INTEGER NOT NULL DEFAULT 0,
  payment_count INTEGER NOT NULL DEFAULT 0,
  last_scanned_at TIMESTAMPTZ,
  last_paid_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_qr_codes_merchant ON public.merchant_qr_codes(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_qr_codes_slug ON public.merchant_qr_codes(slug);
CREATE INDEX IF NOT EXISTS idx_merchant_qr_codes_order ON public.merchant_qr_codes(order_id) WHERE order_id IS NOT NULL;

-- Each merchant has at most ONE active static (any-amount) QR
CREATE UNIQUE INDEX IF NOT EXISTS uniq_merchant_static_qr
  ON public.merchant_qr_codes(merchant_id) WHERE qr_type = 'static' AND is_active = true;

ALTER TABLE public.merchant_qr_codes ENABLE ROW LEVEL SECURITY;

-- Owner-only management (SELECT/INSERT/UPDATE)
CREATE POLICY "Merchants manage own QR codes"
  ON public.merchant_qr_codes FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.gateway_merchants gm
            WHERE gm.id = merchant_qr_codes.merchant_id AND gm.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.merchant_pos_staff s
               WHERE s.merchant_id = merchant_qr_codes.merchant_id
                 AND s.user_id = auth.uid() AND s.status = 'active')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.gateway_merchants gm
            WHERE gm.id = merchant_qr_codes.merchant_id AND gm.user_id = auth.uid())
  );

-- 2. QR scan/payment audit ledger (helps replay/fraud detection)
CREATE TABLE IF NOT EXISTS public.merchant_qr_scan_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_id UUID NOT NULL REFERENCES public.merchant_qr_codes(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL,
  scanned_by_user UUID,                              -- consumer user_id (nullable for anonymous scans)
  scan_outcome TEXT NOT NULL CHECK (scan_outcome IN ('scanned','paid','failed','expired','tampered','duplicate')),
  amount NUMERIC(20,4),
  order_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  error_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qr_scan_log_qr ON public.merchant_qr_scan_log(qr_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_scan_log_merchant ON public.merchant_qr_scan_log(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_scan_log_user ON public.merchant_qr_scan_log(scanned_by_user) WHERE scanned_by_user IS NOT NULL;

ALTER TABLE public.merchant_qr_scan_log ENABLE ROW LEVEL SECURITY;

-- Merchants see their own scan log
CREATE POLICY "Merchants view own scan log"
  ON public.merchant_qr_scan_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.gateway_merchants gm
            WHERE gm.id = merchant_qr_scan_log.merchant_id AND gm.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- 3. Idempotency table for QR payments (server-side, prevents double-pay)
CREATE TABLE IF NOT EXISTS public.qr_payment_idempotency (
  idempotency_key TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  merchant_id UUID NOT NULL,
  amount NUMERIC(20,4) NOT NULL,
  order_id UUID,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qr_idem_user ON public.qr_payment_idempotency(user_id, created_at DESC);

ALTER TABLE public.qr_payment_idempotency ENABLE ROW LEVEL SECURITY;
-- Only the service role uses this; deny all client access by default (no policies = locked)

-- 4. updated_at trigger
CREATE TRIGGER set_merchant_qr_codes_updated_at
  BEFORE UPDATE ON public.merchant_qr_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
