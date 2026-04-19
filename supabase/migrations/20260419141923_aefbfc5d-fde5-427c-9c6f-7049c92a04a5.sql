-- 1. Extend pos_subscription_plans
ALTER TABLE public.pos_subscription_plans
  ADD COLUMN IF NOT EXISTS trial_days INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_publishing_plan BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_renew_default BOOLEAN NOT NULL DEFAULT true;

-- 2. Extend pos_store_subscriptions
ALTER TABLE public.pos_store_subscriptions
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_billing_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS renewal_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_renewal_error TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'wallet';

-- Update status check constraint to allow 'trialing' and 'past_due'
DO $$
DECLARE v_constraint TEXT;
BEGIN
  SELECT con.conname INTO v_constraint
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'pos_store_subscriptions' AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%status%';
  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.pos_store_subscriptions DROP CONSTRAINT %I', v_constraint);
  END IF;
END $$;

ALTER TABLE public.pos_store_subscriptions
  ADD CONSTRAINT pos_store_subscriptions_status_check
  CHECK (status IN ('active', 'trialing', 'past_due', 'cancelled', 'expired'));

CREATE INDEX IF NOT EXISTS idx_pos_subs_next_billing ON public.pos_store_subscriptions(next_billing_attempt_at) WHERE status IN ('active','trialing','past_due');
CREATE INDEX IF NOT EXISTS idx_pos_subs_trial_end ON public.pos_store_subscriptions(trial_ends_at) WHERE status = 'trialing';

-- 3. Subscription events log
CREATE TABLE IF NOT EXISTS public.pos_store_subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.pos_store_subscriptions(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'trial_started','trial_ending_soon','trial_converted','trial_failed',
    'subscription_created','renewed','renewal_failed','past_due',
    'cancelled','expired','reactivated','auto_renew_toggled'
  )),
  amount NUMERIC,
  currency TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_events_sub_id ON public.pos_store_subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_events_merchant ON public.pos_store_subscription_events(merchant_id, created_at DESC);

ALTER TABLE public.pos_store_subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants view own subscription events"
  ON public.pos_store_subscription_events FOR SELECT
  USING (
    merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- 4. Per-merchant trial usage tracker (one-time guard)
CREATE TABLE IF NOT EXISTS public.pos_merchant_trial_usage (
  merchant_id UUID PRIMARY KEY REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  first_trial_plan_id UUID REFERENCES public.pos_subscription_plans(id),
  first_trial_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_trial_ended_at TIMESTAMPTZ,
  converted_to_paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pos_merchant_trial_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants view own trial usage"
  ON public.pos_merchant_trial_usage FOR SELECT
  USING (
    merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- 5. Helper: log subscription event
CREATE OR REPLACE FUNCTION public.log_subscription_event(
  _subscription_id UUID,
  _event_type TEXT,
  _amount NUMERIC DEFAULT NULL,
  _currency TEXT DEFAULT NULL,
  _details JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID; v_merchant UUID;
BEGIN
  SELECT merchant_id INTO v_merchant FROM public.pos_store_subscriptions WHERE id = _subscription_id;
  IF v_merchant IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.pos_store_subscription_events(subscription_id, merchant_id, event_type, amount, currency, details)
  VALUES (_subscription_id, v_merchant, _event_type, _amount, _currency, COALESCE(_details, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- 6. Trigger: log trial_started + create trial_usage record
CREATE OR REPLACE FUNCTION public.handle_subscription_inserted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.trial_ends_at IS NOT NULL AND NEW.status = 'trialing' THEN
    INSERT INTO public.pos_store_subscription_events(subscription_id, merchant_id, event_type, details)
    VALUES (NEW.id, NEW.merchant_id, 'trial_started',
      jsonb_build_object('plan_id', NEW.plan_id, 'trial_ends_at', NEW.trial_ends_at));

    INSERT INTO public.pos_merchant_trial_usage(merchant_id, first_trial_plan_id)
    VALUES (NEW.merchant_id, NEW.plan_id)
    ON CONFLICT (merchant_id) DO NOTHING;
  ELSE
    INSERT INTO public.pos_store_subscription_events(subscription_id, merchant_id, event_type, amount, currency, details)
    VALUES (NEW.id, NEW.merchant_id, 'subscription_created', NULL, NULL,
      jsonb_build_object('plan_id', NEW.plan_id, 'expires_at', NEW.expires_at));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_subscription_inserted ON public.pos_store_subscriptions;
CREATE TRIGGER trg_subscription_inserted
  AFTER INSERT ON public.pos_store_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_subscription_inserted();