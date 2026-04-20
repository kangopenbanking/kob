-- Backfill missing QR scan log + counters for the orphan payment recorded in qr_payment_idempotency
-- but never linked to a QR. Idempotent: safe to run repeatedly.
DO $$
DECLARE
  rec RECORD;
  v_qr_id UUID;
BEGIN
  FOR rec IN
    SELECT i.idempotency_key, i.user_id, i.merchant_id, i.amount, i.order_id, i.created_at
    FROM public.qr_payment_idempotency i
    LEFT JOIN public.merchant_qr_scan_log s
      ON s.merchant_id = i.merchant_id
     AND s.scan_outcome = 'paid'
     AND ABS(EXTRACT(EPOCH FROM (s.created_at - i.created_at))) < 60
     AND COALESCE(s.amount, 0) = COALESCE(i.amount, 0)
    WHERE s.id IS NULL
  LOOP
    SELECT id INTO v_qr_id FROM public.merchant_qr_codes
      WHERE merchant_id = rec.merchant_id AND qr_type = 'static' AND is_active = true
      LIMIT 1;

    INSERT INTO public.merchant_qr_scan_log
      (qr_id, merchant_id, scanned_by_user, scan_outcome, amount, order_id, created_at)
    VALUES
      (v_qr_id, rec.merchant_id, rec.user_id, 'paid', rec.amount, rec.order_id, rec.created_at);

    IF v_qr_id IS NOT NULL THEN
      UPDATE public.merchant_qr_codes
      SET payment_count = COALESCE(payment_count, 0) + 1,
          scan_count = COALESCE(scan_count, 0) + 1,
          last_paid_at = rec.created_at,
          last_scanned_at = COALESCE(last_scanned_at, rec.created_at)
      WHERE id = v_qr_id;
    END IF;
  END LOOP;
END $$;