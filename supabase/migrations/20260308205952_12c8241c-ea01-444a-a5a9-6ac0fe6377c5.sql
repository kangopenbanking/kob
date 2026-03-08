-- Fix enterprise_leads: use correct column name 'email' instead of 'contact_email'
DROP POLICY IF EXISTS "Anyone can submit enterprise leads" ON public.enterprise_leads;
CREATE POLICY "Validated enterprise lead submission" ON public.enterprise_leads
  FOR INSERT WITH CHECK (
    company_name IS NOT NULL AND
    company_name != '' AND
    email IS NOT NULL AND
    email != ''
  );

-- Fix duplicate captcha policy
DROP POLICY IF EXISTS "Service role only access" ON public.captcha_challenges;

-- Fix mutable search_path functions
CREATE OR REPLACE FUNCTION public.get_daily_fee_summary(
  p_start_date date DEFAULT NULL::date,
  p_end_date date DEFAULT NULL::date,
  p_institution_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  institution_id uuid, institution_name text, fee_date date,
  transaction_type text, transaction_count bigint,
  total_transaction_volume numeric, total_calculated_fees numeric,
  total_waivers numeric, total_final_fees numeric,
  average_fee_per_transaction numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    tf.institution_id,
    i.institution_name,
    DATE(tf.transaction_date) as fee_date,
    tf.transaction_type,
    COUNT(*) as transaction_count,
    SUM(tf.transaction_amount) as total_transaction_volume,
    SUM(tf.calculated_fee) as total_calculated_fees,
    SUM(tf.waived_amount) as total_waivers,
    SUM(tf.final_fee) as total_final_fees,
    AVG(tf.final_fee) as average_fee_per_transaction
  FROM transaction_fees tf
  JOIN institutions i ON tf.institution_id = i.id
  WHERE 
    (p_start_date IS NULL OR DATE(tf.transaction_date) >= p_start_date)
    AND (p_end_date IS NULL OR DATE(tf.transaction_date) <= p_end_date)
    AND (p_institution_id IS NULL OR tf.institution_id = p_institution_id)
  GROUP BY tf.institution_id, i.institution_name, DATE(tf.transaction_date), tf.transaction_type
  ORDER BY fee_date DESC, institution_name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_escrow_wallet_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;