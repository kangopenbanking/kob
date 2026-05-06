-- Expose KOB wallet id + business_email in the public merchant_qr_directory view so
-- external virtual-card apps (e.g. Kang Card) can route credits to the merchant's
-- KOB wallet without a workaround. Standing Order 4 (Surgeon Rule): additive only.
CREATE OR REPLACE VIEW public.merchant_qr_directory AS
SELECT
  gm.id AS merchant_id,
  gm.business_name AS name,
  gm.environment,
  gm.status,
  COALESCE(gm.metadata ->> 'mcc', '') AS mcc,
  COALESCE(gm.metadata ->> 'country', 'CM') AS country,
  COALESCE(gm.metadata ->> 'logo_url', '') AS logo_url,
  CASE
    WHEN lower(gm.kyb_status) IN ('approved', 'verified') THEN true
    ELSE false
  END AS verified,
  gm.created_at,
  w.id  AS kob_wallet_id,
  w.currency AS wallet_currency
FROM public.gateway_merchants gm
LEFT JOIN public.gateway_merchant_wallets w
  ON w.merchant_id = gm.id
 AND lower(w.currency) = lower(COALESCE(gm.metadata ->> 'default_currency', 'XAF'))
WHERE lower(gm.status) IN ('active', 'verified')
  AND lower(gm.kyb_status) IN ('approved', 'verified');

GRANT SELECT ON public.merchant_qr_directory TO anon, authenticated;