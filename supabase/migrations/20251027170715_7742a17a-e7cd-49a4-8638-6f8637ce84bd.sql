-- Insert test API clients for OAuth testing in developer portal
-- Uses actual api_clients schema columns

DO $$
DECLARE
  test_institution_id UUID;
BEGIN
  -- Get first test institution (sandbox environment)
  SELECT id INTO test_institution_id
  FROM public.institutions
  WHERE sandbox_access = true
  LIMIT 1;
  
  -- Only proceed if we found a test institution
  IF test_institution_id IS NOT NULL THEN
    -- Insert test OAuth client for AISP (Account Information)
    INSERT INTO public.api_clients (
      id,
      client_id,
      client_secret_hash,
      client_name,
      institution_id,
      redirect_uris,
      scopes,
      grant_types,
      is_active
    ) VALUES (
      gen_random_uuid(),
      'test_aisp_client_001',
      crypt('test_aisp_secret_001', gen_salt('bf', 10)),
      'Test AISP Application',
      test_institution_id,
      jsonb_build_array('http://localhost:5173/callback', 'https://oauth.pstmn.io/v1/callback'),
      jsonb_build_array('accounts', 'transactions', 'balances'),
      jsonb_build_array('authorization_code', 'refresh_token'),
      true
    )
    ON CONFLICT (client_id) DO NOTHING;
    
    -- Insert test OAuth client for PISP (Payment Initiation)
    INSERT INTO public.api_clients (
      id,
      client_id,
      client_secret_hash,
      client_name,
      institution_id,
      redirect_uris,
      scopes,
      grant_types,
      is_active
    ) VALUES (
      gen_random_uuid(),
      'test_pisp_client_001',
      crypt('test_pisp_secret_001', gen_salt('bf', 10)),
      'Test PISP Application',
      test_institution_id,
      jsonb_build_array('http://localhost:5173/callback', 'https://oauth.pstmn.io/v1/callback'),
      jsonb_build_array('payments'),
      jsonb_build_array('authorization_code', 'refresh_token'),
      true
    )
    ON CONFLICT (client_id) DO NOTHING;
    
    -- Insert test OAuth client for Combined AISP+PISP
    INSERT INTO public.api_clients (
      id,
      client_id,
      client_secret_hash,
      client_name,
      institution_id,
      redirect_uris,
      scopes,
      grant_types,
      is_active
    ) VALUES (
      gen_random_uuid(),
      'test_combined_client_001',
      crypt('test_combined_secret_001', gen_salt('bf', 10)),
      'Test Combined AISP+PISP Application',
      test_institution_id,
      jsonb_build_array('http://localhost:5173/callback', 'https://oauth.pstmn.io/v1/callback'),
      jsonb_build_array('accounts', 'transactions', 'balances', 'payments'),
      jsonb_build_array('authorization_code', 'refresh_token'),
      true
    )
    ON CONFLICT (client_id) DO NOTHING;
  END IF;
END $$;

COMMENT ON TABLE public.api_clients IS 'OAuth 2.0 clients with test credentials for API development and testing';