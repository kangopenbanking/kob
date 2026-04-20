
CREATE OR REPLACE FUNCTION public.increment_qr_scan(_qr_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.merchant_qr_codes
  SET scan_count = scan_count + 1,
      last_scanned_at = now()
  WHERE id = _qr_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_qr_payment(_qr_id UUID, _amount NUMERIC)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.merchant_qr_codes
  SET payment_count = payment_count + 1,
      last_paid_at = now()
  WHERE id = _qr_id;
$$;

REVOKE ALL ON FUNCTION public.increment_qr_scan(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_qr_payment(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_qr_scan(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.increment_qr_payment(UUID, NUMERIC) TO authenticated, service_role;
