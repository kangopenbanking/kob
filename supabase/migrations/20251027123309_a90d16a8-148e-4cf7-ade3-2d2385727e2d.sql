-- Fix SECURITY DEFINER functions to include SET search_path for security
-- This prevents search_path manipulation attacks

-- Fix calculate_kyc_risk_score function
CREATE OR REPLACE FUNCTION public.calculate_kyc_risk_score(_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- Fixed: prevent search_path manipulation
AS $$
DECLARE
  v_risk_score INTEGER := 0;
  v_kyc_status TEXT;
  v_cdd RECORD;
BEGIN
  -- Check KYC verification status
  SELECT status INTO v_kyc_status
  FROM kyc_verifications
  WHERE user_id = _user_id
    AND verification_type = 'identity'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_kyc_status IS NULL THEN
    v_risk_score := v_risk_score + 50; -- No KYC
  ELSIF v_kyc_status = 'rejected' THEN
    v_risk_score := v_risk_score + 40;
  ELSIF v_kyc_status = 'pending' THEN
    v_risk_score := v_risk_score + 30;
  END IF;
  
  -- Check CDD factors
  SELECT * INTO v_cdd
  FROM customer_due_diligence
  WHERE user_id = _user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_cdd IS NOT NULL THEN
    IF v_cdd.pep_status THEN
      v_risk_score := v_risk_score + 30;
    END IF;
    
    IF v_cdd.risk_category = 'enhanced' THEN
      v_risk_score := v_risk_score + 20;
    END IF;
  END IF;
  
  -- Check sanctions screening
  IF EXISTS (
    SELECT 1 FROM sanctions_screening
    WHERE user_id = _user_id
      AND screening_status IN ('potential_match', 'confirmed_match')
  ) THEN
    v_risk_score := v_risk_score + 50;
  END IF;
  
  -- Cap at 100
  RETURN LEAST(v_risk_score, 100);
END;
$$;

-- Ensure RLS is enabled on all public tables that need it
-- Only enable if not already enabled to avoid errors

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Enable RLS on tables in public schema that don't have it
  FOR r IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename NOT IN (
        SELECT tablename 
        FROM pg_tables t
        JOIN pg_class c ON c.relname = t.tablename
        WHERE c.relrowsecurity = true
          AND t.schemaname = 'public'
      )
      -- Exclude system tables
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT LIKE 'sql_%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    RAISE NOTICE 'Enabled RLS on table: %', r.tablename;
  END LOOP;
END;
$$;