INSERT INTO public.tpp_registrations (
  client_id,
  institution_id,
  client_name,
  software_id,
  software_statement,
  software_roles,
  redirect_uris,
  grant_types,
  response_types,
  token_endpoint_auth_method,
  scope,
  is_active,
  environment,
  require_mtls,
  fapi_profile
)
SELECT
  'kang_consumer_wallet_pisp',
  i.id,
  'KANG Consumer Wallet Pay by Bank',
  'kang-consumer-wallet-pisp',
  'KANG platform payment initiation client for consumer wallet Pay by Bank top-ups',
  ARRAY['PISP'],
  ARRAY['https://kob.lovable.app/pay/authorize', 'https://kob.lovable.app/app/fund', 'https://info.kangfintechsolutions.com/pay/authorize'],
  ARRAY['authorization_code'],
  ARRAY['code'],
  'private_key_jwt',
  'payments',
  true,
  'production',
  false,
  'baseline'
FROM public.institutions i
WHERE i.institution_name = 'Kang'
ORDER BY i.created_at ASC
LIMIT 1
ON CONFLICT (client_id) DO UPDATE SET
  institution_id = EXCLUDED.institution_id,
  client_name = EXCLUDED.client_name,
  software_roles = EXCLUDED.software_roles,
  redirect_uris = EXCLUDED.redirect_uris,
  grant_types = EXCLUDED.grant_types,
  response_types = EXCLUDED.response_types,
  token_endpoint_auth_method = EXCLUDED.token_endpoint_auth_method,
  scope = EXCLUDED.scope,
  is_active = EXCLUDED.is_active,
  environment = EXCLUDED.environment,
  require_mtls = EXCLUDED.require_mtls,
  fapi_profile = EXCLUDED.fapi_profile,
  updated_at = now();