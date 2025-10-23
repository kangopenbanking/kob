-- Fix security definer view warning
DROP VIEW IF EXISTS daily_fee_summary;

CREATE VIEW daily_fee_summary AS
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
GROUP BY tf.institution_id, i.institution_name, DATE(tf.transaction_date), tf.transaction_type
ORDER BY fee_date DESC, institution_name;

GRANT SELECT ON daily_fee_summary TO authenticated;