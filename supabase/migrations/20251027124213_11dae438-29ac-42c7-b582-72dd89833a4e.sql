-- Fix SECURITY DEFINER view by converting to SECURITY INVOKER function
-- This ensures RLS policies are properly enforced

-- Drop the existing view
DROP VIEW IF EXISTS daily_fee_summary;

-- Create a SECURITY INVOKER function instead that respects RLS
-- This runs with the caller's privileges, not the creator's
CREATE OR REPLACE FUNCTION public.get_daily_fee_summary(
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_institution_id uuid DEFAULT NULL
)
RETURNS TABLE (
  institution_id uuid,
  institution_name text,
  fee_date date,
  transaction_type text,
  transaction_count bigint,
  total_transaction_volume numeric,
  total_calculated_fees numeric,
  total_waivers numeric,
  total_final_fees numeric,
  average_fee_per_transaction numeric
)
LANGUAGE plpgsql
SECURITY INVOKER  -- Runs with caller's privileges, respects RLS
SET search_path = public
AS $$
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
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_daily_fee_summary TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.get_daily_fee_summary IS 
'Returns daily fee summary with RLS enforcement. Replaces daily_fee_summary view for security compliance.';