
-- Create notification trigger for storefront profile changes (publish/unpublish)
CREATE OR REPLACE FUNCTION public.notify_storefront_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_merchant_user_id UUID;
  v_notif_type TEXT;
  v_title TEXT;
  v_message TEXT;
BEGIN
  -- Only fire on publish status changes
  IF OLD.is_published IS NOT DISTINCT FROM NEW.is_published THEN RETURN NEW; END IF;

  -- Get merchant owner user_id
  SELECT user_id INTO v_merchant_user_id
  FROM public.gateway_merchants
  WHERE id = NEW.merchant_id;

  IF v_merchant_user_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.is_published THEN
    v_notif_type := 'success';
    v_title := 'Store Published';
    v_message := format('Your store "%s" is now live on the KOB marketplace! Customers can discover and order from you.', NEW.store_name);
  ELSE
    v_notif_type := 'info';
    v_title := 'Store Unpublished';
    v_message := format('Your store "%s" has been unpublished and is no longer visible to customers.', NEW.store_name);
  END IF;

  INSERT INTO public.app_notifications (user_id, type, title, message, icon, metadata)
  VALUES (
    v_merchant_user_id,
    v_notif_type,
    v_title,
    v_message,
    'storefront',
    jsonb_build_object('store_id', NEW.id, 'store_name', NEW.store_name, 'is_published', NEW.is_published)
  );

  RETURN NEW;
END;
$$;

-- Attach trigger to pos_store_profiles
DROP TRIGGER IF EXISTS trg_notify_storefront_status ON public.pos_store_profiles;
CREATE TRIGGER trg_notify_storefront_status
  AFTER UPDATE ON public.pos_store_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_storefront_status_change();

-- Create notification trigger for subscription changes
CREATE OR REPLACE FUNCTION public.notify_storefront_subscription_change()
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
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  SELECT gm.user_id, sp.store_name INTO v_merchant_user_id, v_store_name
  FROM public.gateway_merchants gm
  LEFT JOIN public.pos_store_profiles sp ON sp.merchant_id = gm.id
  WHERE gm.id = NEW.merchant_id;

  SELECT name INTO v_plan_name FROM public.pos_subscription_plans WHERE id = NEW.plan_id;

  IF v_merchant_user_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.status = 'active' THEN
    INSERT INTO public.app_notifications (user_id, type, title, message, icon, metadata)
    VALUES (
      v_merchant_user_id, 'success',
      'Subscription Activated',
      format('Your %s plan for "%s" is now active. Your store can appear on the marketplace.', COALESCE(v_plan_name, 'POS'), COALESCE(v_store_name, 'your store')),
      'storefront',
      jsonb_build_object('subscription_id', NEW.id, 'plan_id', NEW.plan_id, 'status', NEW.status)
    );
  ELSIF NEW.status = 'expired' THEN
    INSERT INTO public.app_notifications (user_id, type, title, message, icon, metadata)
    VALUES (
      v_merchant_user_id, 'warning',
      'Subscription Expired',
      format('Your POS subscription for "%s" has expired. Renew to stay visible on the marketplace.', COALESCE(v_store_name, 'your store')),
      'storefront',
      jsonb_build_object('subscription_id', NEW.id, 'plan_id', NEW.plan_id, 'status', NEW.status)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_storefront_subscription ON public.pos_store_subscriptions;
CREATE TRIGGER trg_notify_storefront_subscription
  AFTER UPDATE ON public.pos_store_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_storefront_subscription_change();
