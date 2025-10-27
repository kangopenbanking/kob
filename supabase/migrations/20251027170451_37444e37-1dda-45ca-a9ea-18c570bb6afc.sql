-- Insert test financial institutions for development/testing
-- Uses existing user from auth.users table

DO $$
DECLARE
  system_user_id UUID;
BEGIN
  -- Get first available user from auth.users
  SELECT id INTO system_user_id
  FROM auth.users
  LIMIT 1;
  
  -- Only proceed if we found a user
  IF system_user_id IS NOT NULL THEN
    -- Test Bank 1: Commercial Bank of Cameroon (CBC)
    INSERT INTO public.institutions (
      id,
      user_id,
      institution_name,
      institution_type,
      registration_number,
      country,
      address,
      phone,
      website,
      status,
      sandbox_access,
      sandbox_credentials
    ) VALUES (
      gen_random_uuid(),
      system_user_id,
      'Commercial Bank of Cameroon (Test)',
      'bank',
      'RC/YAO/2024/TEST001',
      'Cameroon',
      '123 Kennedy Avenue, Yaoundé, Cameroon',
      '+237 222 123 456',
      'https://cbc-cm.example.com',
      'approved',
      true,
      jsonb_build_object(
        'client_id', 'test_cbc_client_001',
        'secret_hash', crypt('test_cbc_secret_001', gen_salt('bf', 10)),
        'encrypted_at', NOW(),
        'bic_code', 'CBCMCMCX',
        'api_base_url', 'https://api-sandbox.cbc-cm.example.com',
        'environment', 'sandbox'
      )
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Test Bank 2: Afriland First Bank
    INSERT INTO public.institutions (
      id,
      user_id,
      institution_name,
      institution_type,
      registration_number,
      country,
      address,
      phone,
      website,
      status,
      sandbox_access,
      sandbox_credentials
    ) VALUES (
      gen_random_uuid(),
      system_user_id,
      'Afriland First Bank (Test)',
      'bank',
      'RC/DLA/2024/TEST002',
      'Cameroon',
      '456 Boulevard de la Liberté, Douala, Cameroon',
      '+237 233 456 789',
      'https://afrilandfirstbank.example.com',
      'approved',
      true,
      jsonb_build_object(
        'client_id', 'test_afb_client_001',
        'secret_hash', crypt('test_afb_secret_001', gen_salt('bf', 10)),
        'encrypted_at', NOW(),
        'bic_code', 'CCEYCMCX',
        'api_base_url', 'https://api-sandbox.afrilandfirstbank.example.com',
        'environment', 'sandbox'
      )
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Test Mobile Money Provider: MTN Mobile Money (fintech)
    INSERT INTO public.institutions (
      id,
      user_id,
      institution_name,
      institution_type,
      registration_number,
      country,
      address,
      phone,
      website,
      status,
      sandbox_access,
      sandbox_credentials
    ) VALUES (
      gen_random_uuid(),
      system_user_id,
      'MTN Mobile Money (Test)',
      'fintech',
      'RC/YAO/2024/TEST003',
      'Cameroon',
      '789 Rue de la Réunification, Yaoundé, Cameroon',
      '+237 670 000 000',
      'https://mtn-momo.example.com',
      'approved',
      true,
      jsonb_build_object(
        'client_id', 'test_mtn_client_001',
        'secret_hash', crypt('test_mtn_secret_001', gen_salt('bf', 10)),
        'encrypted_at', NOW(),
        'api_base_url', 'https://api-sandbox.mtn-momo.example.com',
        'environment', 'sandbox'
      )
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Test Mobile Money Provider: Orange Money (fintech)
    INSERT INTO public.institutions (
      id,
      user_id,
      institution_name,
      institution_type,
      registration_number,
      country,
      address,
      phone,
      website,
      status,
      sandbox_access,
      sandbox_credentials
    ) VALUES (
      gen_random_uuid(),
      system_user_id,
      'Orange Money (Test)',
      'fintech',
      'RC/DLA/2024/TEST004',
      'Cameroon',
      '321 Avenue Charles de Gaulle, Douala, Cameroon',
      '+237 690 000 000',
      'https://orange-money.example.com',
      'approved',
      true,
      jsonb_build_object(
        'client_id', 'test_orange_client_001',
        'secret_hash', crypt('test_orange_secret_001', gen_salt('bf', 10)),
        'encrypted_at', NOW(),
        'api_base_url', 'https://api-sandbox.orange-money.example.com',
        'environment', 'sandbox'
      )
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Test Microfinance Institution (credit_union)
    INSERT INTO public.institutions (
      id,
      user_id,
      institution_name,
      institution_type,
      registration_number,
      country,
      address,
      phone,
      website,
      status,
      sandbox_access,
      sandbox_credentials
    ) VALUES (
      gen_random_uuid(),
      system_user_id,
      'Express Union Finance (Test)',
      'credit_union',
      'RC/YAO/2024/TEST005',
      'Cameroon',
      '555 Rue du Commerce, Yaoundé, Cameroon',
      '+237 222 555 888',
      'https://expressunion.example.com',
      'approved',
      true,
      jsonb_build_object(
        'client_id', 'test_eu_client_001',
        'secret_hash', crypt('test_eu_secret_001', gen_salt('bf', 10)),
        'encrypted_at', NOW(),
        'api_base_url', 'https://api-sandbox.expressunion.example.com',
        'environment', 'sandbox'
      )
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;