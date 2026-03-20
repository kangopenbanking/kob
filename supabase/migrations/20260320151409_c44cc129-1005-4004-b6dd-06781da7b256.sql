-- Create a trigger function to notify merchants when subscription expires
CREATE OR REPLACE FUNCTION public.notify_subscription_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_merchant_user_id UUID;
  v_store_name TEXT;
  v_plan_name TEXT;
BEGIN
  -- Only fire on status change to expired
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  IF NEW.status != 'expired' THEN RETURN NEW; END IF;

  -- Get merchant user_id and store name
  SELECT gm.user_id INTO v_merchant_user_id
  FROM public.gateway_merchants gm
  WHERE gm.id = NEW.merchant_id;

  SELECT sp.store_name INTO v_store_name
  FROM public.pos_store_profiles sp
  WHERE sp.merchant_id = NEW.merchant_id;

  SELECT p.name INTO v_plan_name
  FROM public.pos_subscription_plans p
  WHERE p.id = NEW.plan_id;

  IF v_merchant_user_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.app_notifications (user_id, type, title, message, icon, metadata)
  VALUES (
    v_merchant_user_id,
    'warning',
    'Subscription Expired',
    format('Your %s plan for "%s" has expired. Renew now to stay listed on the marketplace.', COALESCE(v_plan_name, 'store'), COALESCE(v_store_name, 'your store')),
    'subscription',
    jsonb_build_object(
      'subscription_id', NEW.id,
      'merchant_id', NEW.merchant_id,
      'plan_id', NEW.plan_id,
      'expired_at', NEW.expires_at
    )
  );

  RETURN NEW;
END;
$$;

-- Attach trigger to pos_store_subscriptions
DROP TRIGGER IF EXISTS trg_notify_subscription_expiry ON public.pos_store_subscriptions;
CREATE TRIGGER trg_notify_subscription_expiry
  AFTER UPDATE ON public.pos_store_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_subscription_expiry();

-- Function to check for upcoming expiry (within 3 days) and send warning notifications
CREATE OR REPLACE FUNCTION public.notify_subscription_expiry_warning()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sub RECORD;
  v_merchant_user_id UUID;
  v_store_name TEXT;
  v_plan_name TEXT;
  v_days_left INT;
  v_already_notified BOOLEAN;
BEGIN
  FOR v_sub IN
    SELECT s.id, s.merchant_id, s.plan_id, s.expires_at
    FROM public.pos_store_subscriptions s
    WHERE s.status = 'active'
      AND s.expires_at <= NOW() + INTERVAL '3 days'
      AND s.expires_at > NOW()
  LOOP
    v_days_left := GREATEST(EXTRACT(DAY FROM (v_sub.expires_at - NOW()))::INT, 0);

    -- Check if we already sent a warning for this subscription
    SELECT EXISTS(
      SELECT 1 FROM public.app_notifications
      WHERE metadata->>'subscription_id' = v_sub.id::TEXT
        AND title = 'Subscription Expiring Soon'
        AND created_at > NOW() - INTERVAL '1 day'
    ) INTO v_already_notified;

    IF v_already_notified THEN CONTINUE; END IF;

    SELECT gm.user_id INTO v_merchant_user_id
    FROM public.gateway_merchants gm WHERE gm.id = v_sub.merchant_id;

    SELECT sp.store_name INTO v_store_name
    FROM public.pos_store_profiles sp WHERE sp.merchant_id = v_sub.merchant_id;

    SELECT p.name INTO v_plan_name
    FROM public.pos_subscription_plans p WHERE p.id = v_sub.plan_id;

    IF v_merchant_user_id IS NULL THEN CONTINUE; END IF;

    INSERT INTO public.app_notifications (user_id, type, title, message, icon, metadata)
    VALUES (
      v_merchant_user_id,
      'warning',
      'Subscription Expiring Soon',
      format('Your %s plan for "%s" expires in %s day(s). Renew now to keep your store listed.',
        COALESCE(v_plan_name, 'store'), COALESCE(v_store_name, 'your store'), v_days_left),
      'subscription',
      jsonb_build_object(
        'subscription_id', v_sub.id,
        'merchant_id', v_sub.merchant_id,
        'plan_id', v_sub.plan_id,
        'expires_at', v_sub.expires_at,
        'days_left', v_days_left
      )
    );
  END LOOP;
END;
$$;