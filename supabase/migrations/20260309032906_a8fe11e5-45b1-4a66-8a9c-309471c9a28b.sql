-- Function to auto-expire store visibility when subscriptions lapse
CREATE OR REPLACE FUNCTION public.expire_store_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Mark expired subscriptions
  UPDATE pos_store_subscriptions
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at < NOW();

  -- Unpublish stores whose merchants have no active subscription
  UPDATE pos_store_profiles
  SET is_published = false,
      updated_at = NOW()
  WHERE is_published = true
    AND merchant_id NOT IN (
      SELECT DISTINCT merchant_id
      FROM pos_store_subscriptions
      WHERE status = 'active'
        AND expires_at >= NOW()
    );
END;
$$;