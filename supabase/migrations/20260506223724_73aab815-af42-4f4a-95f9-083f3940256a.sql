-- Allow public read of KYB-approved merchants for the public QR directory.
-- Without this, the merchant_qr_directory view returned empty for anon callers
-- because gateway_merchants RLS only exposed rows to owners/admins.
DROP POLICY IF EXISTS "Public can view KYB-approved merchants" ON public.gateway_merchants;
CREATE POLICY "Public can view KYB-approved merchants"
ON public.gateway_merchants
FOR SELECT
TO anon, authenticated
USING (
  lower(status) IN ('active', 'verified')
  AND lower(kyb_status) IN ('approved', 'verified')
);