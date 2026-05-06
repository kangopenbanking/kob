-- Fix merchant_qr_directory view to surface KYB-verified merchants.
-- Standing Order 4 (Surgeon Rule): additive only — broaden filter, do not rename columns.
CREATE OR REPLACE VIEW public.merchant_qr_directory AS
SELECT
  id AS merchant_id,
  business_name AS name,
  environment,
  status,
  COALESCE(metadata ->> 'mcc', '') AS mcc,
  COALESCE(metadata ->> 'country', 'CM') AS country,
  COALESCE(metadata ->> 'logo_url', '') AS logo_url,
  CASE
    WHEN lower(kyb_status) IN ('approved', 'verified') THEN true
    ELSE false
  END AS verified,
  created_at
FROM public.gateway_merchants gm
WHERE lower(status) IN ('active', 'verified')
  AND lower(kyb_status) IN ('approved', 'verified');