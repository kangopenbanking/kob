
-- =============================================================
-- DDN Phase 9 — Driver notifications + admin-configurable rules
-- =============================================================

-- 1) Admin-managed rule set (single-row settings)
CREATE TABLE IF NOT EXISTS public.ddn_driver_notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  offer_in_app_enabled boolean NOT NULL DEFAULT true,
  offer_push_enabled boolean NOT NULL DEFAULT true,
  offer_warn_seconds int NOT NULL DEFAULT 10,        -- warn driver when X seconds remain on offer
  assignment_change_in_app boolean NOT NULL DEFAULT true,
  assignment_change_push boolean NOT NULL DEFAULT true,
  missed_pickup_minutes int NOT NULL DEFAULT 15,     -- minutes after accepted with no picked_up_at
  missed_pickup_push boolean NOT NULL DEFAULT true,
  missed_pickup_in_app boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ddn_driver_notification_rules TO authenticated;
GRANT ALL ON public.ddn_driver_notification_rules TO service_role;

ALTER TABLE public.ddn_driver_notification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rules_read_authenticated"
  ON public.ddn_driver_notification_rules FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "rules_admin_write"
  ON public.ddn_driver_notification_rules FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed the singleton row
INSERT INTO public.ddn_driver_notification_rules (singleton)
VALUES (true) ON CONFLICT (singleton) DO NOTHING;

-- 2) Helper: load current rules
CREATE OR REPLACE FUNCTION public.ddn_get_notification_rules()
RETURNS public.ddn_driver_notification_rules
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.ddn_driver_notification_rules WHERE singleton = true LIMIT 1;
$$;

-- 3) Trigger: notify driver when a new offer arrives
CREATE OR REPLACE FUNCTION public.ddn_notify_driver_on_offer()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid;
  v_rules public.ddn_driver_notification_rules;
  v_amount int;
BEGIN
  v_rules := public.ddn_get_notification_rules();
  IF NOT v_rules.offer_in_app_enabled THEN RETURN NEW; END IF;

  SELECT user_id INTO v_user_id FROM public.ddn_drivers WHERE id = NEW.driver_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  SELECT driver_earnings_xaf INTO v_amount FROM public.ddn_assignments WHERE id = NEW.assignment_id;

  INSERT INTO public.app_notifications (user_id, type, title, message, icon, metadata, idempotency_key, is_read)
  VALUES (
    v_user_id,
    'ddn.offer.new',
    'New delivery offer',
    'You have a new offer worth ' || COALESCE(v_amount, 0)::text || ' XAF. Tap to review.',
    'truck',
    jsonb_build_object('offer_id', NEW.id, 'assignment_id', NEW.assignment_id, 'expires_at', NEW.expires_at),
    'ddn.offer.new:' || NEW.id::text,
    false
  ) ON CONFLICT (user_id, idempotency_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ddn_notify_driver_on_offer ON public.ddn_assignment_offers;
CREATE TRIGGER trg_ddn_notify_driver_on_offer
AFTER INSERT ON public.ddn_assignment_offers
FOR EACH ROW EXECUTE FUNCTION public.ddn_notify_driver_on_offer();

-- 4) Trigger: notify driver on assignment status change (cancellation, reassignment)
CREATE OR REPLACE FUNCTION public.ddn_notify_driver_on_assignment_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid;
  v_rules public.ddn_driver_notification_rules;
  v_title text;
  v_msg text;
BEGIN
  IF NEW.driver_id IS NULL OR NEW.status = OLD.status THEN RETURN NEW; END IF;
  v_rules := public.ddn_get_notification_rules();
  IF NOT v_rules.assignment_change_in_app THEN RETURN NEW; END IF;

  SELECT user_id INTO v_user_id FROM public.ddn_drivers WHERE id = NEW.driver_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.status = 'cancelled' THEN
    v_title := 'Delivery cancelled';
    v_msg := 'A delivery you accepted was cancelled by the merchant or customer.';
  ELSIF NEW.status = 'assignment_failed' THEN
    v_title := 'Assignment failed';
    v_msg := 'The system could not complete this assignment. You are free to take new offers.';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.app_notifications (user_id, type, title, message, icon, metadata, idempotency_key, is_read)
  VALUES (
    v_user_id, 'ddn.assignment.change.' || NEW.status, v_title, v_msg, 'alert-circle',
    jsonb_build_object('assignment_id', NEW.id, 'from', OLD.status, 'to', NEW.status),
    'ddn.assignment.change:' || NEW.id::text || ':' || NEW.status,
    false
  ) ON CONFLICT (user_id, idempotency_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ddn_notify_driver_on_assignment_change ON public.ddn_assignments;
CREATE TRIGGER trg_ddn_notify_driver_on_assignment_change
AFTER UPDATE OF status ON public.ddn_assignments
FOR EACH ROW EXECUTE FUNCTION public.ddn_notify_driver_on_assignment_change();

-- 5) Function: flag missed-pickup windows. Cron-callable via service role.
CREATE OR REPLACE FUNCTION public.ddn_flag_missed_pickups()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rules public.ddn_driver_notification_rules;
  v_threshold timestamptz;
  v_count int := 0;
  r record;
BEGIN
  v_rules := public.ddn_get_notification_rules();
  IF NOT v_rules.missed_pickup_in_app THEN RETURN 0; END IF;
  v_threshold := now() - (v_rules.missed_pickup_minutes || ' minutes')::interval;

  FOR r IN
    SELECT a.id, a.assigned_at, a.driver_id, d.user_id
      FROM public.ddn_assignments a
      JOIN public.ddn_drivers d ON d.id = a.driver_id
     WHERE a.status = 'accepted'
       AND a.picked_up_at IS NULL
       AND a.assigned_at IS NOT NULL
       AND a.assigned_at < v_threshold
  LOOP
    INSERT INTO public.app_notifications (user_id, type, title, message, icon, metadata, idempotency_key, is_read)
    VALUES (
      r.user_id, 'ddn.pickup.missed',
      'Pickup window missed',
      'You are late picking up an accepted order. Please proceed now or it may be reassigned.',
      'alert-triangle',
      jsonb_build_object('assignment_id', r.id, 'assigned_at', r.assigned_at, 'threshold_minutes', v_rules.missed_pickup_minutes),
      'ddn.pickup.missed:' || r.id::text,
      false
    ) ON CONFLICT (user_id, idempotency_key) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
