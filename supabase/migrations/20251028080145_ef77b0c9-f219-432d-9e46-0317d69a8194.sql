-- Drop and recreate the view without security definer issues
DROP VIEW IF EXISTS credit_score_distribution;

CREATE VIEW credit_score_distribution 
WITH (security_invoker = true)
AS
SELECT 
  CASE 
    WHEN score >= 800 THEN 'Excellent (800-850)'
    WHEN score >= 740 THEN 'Very Good (740-799)'
    WHEN score >= 670 THEN 'Good (670-739)'
    WHEN score >= 580 THEN 'Fair (580-669)'
    ELSE 'Poor (300-579)'
  END as score_range,
  COUNT(*) as user_count,
  ROUND(AVG(score)) as avg_score
FROM credit_scores
WHERE status = 'active'
  AND calculated_at > NOW() - INTERVAL '30 days'
GROUP BY score_range
ORDER BY avg_score DESC;