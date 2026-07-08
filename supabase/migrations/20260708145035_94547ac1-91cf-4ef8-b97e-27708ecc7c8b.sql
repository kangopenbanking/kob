
-- 1. Audit table
CREATE TABLE IF NOT EXISTS public.giveting_campaign_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.giveting_campaigns(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created','status_changed','edited','donation','withdrawal','auto_published_kyc','moderated'
  )),
  from_status TEXT,
  to_status TEXT,
  actor_user_id UUID,
  actor_role TEXT,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gce_campaign ON public.giveting_campaign_events(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gce_owner ON public.giveting_campaign_events(owner_user_id, created_at DESC);

GRANT SELECT ON public.giveting_campaign_events TO authenticated;
GRANT ALL ON public.giveting_campaign_events TO service_role;

ALTER TABLE public.giveting_campaign_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read own campaign events" ON public.giveting_campaign_events;
CREATE POLICY "Owners read own campaign events" ON public.giveting_campaign_events
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 2. Generic status-change audit trigger
CREATE OR REPLACE FUNCTION public.giveting_log_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.giveting_campaign_events (campaign_id, owner_user_id, event_type, to_status, actor_user_id)
    VALUES (NEW.id, NEW.owner_user_id, 'created', NEW.status, NEW.owner_user_id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.giveting_campaign_events (
      campaign_id, owner_user_id, event_type, from_status, to_status,
      actor_user_id, metadata
    ) VALUES (
      NEW.id, NEW.owner_user_id, 'status_changed', OLD.status, NEW.status,
      NEW.moderated_by,
      jsonb_build_object('published_at', NEW.published_at, 'moderation_notes', NEW.moderation_notes)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_giveting_status_audit ON public.giveting_campaigns;
CREATE TRIGGER trg_giveting_status_audit
AFTER INSERT OR UPDATE OF status ON public.giveting_campaigns
FOR EACH ROW EXECUTE FUNCTION public.giveting_log_status_change();

-- 3. Donation + withdrawal audit triggers
CREATE OR REPLACE FUNCTION public.giveting_log_donation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner UUID;
BEGIN
  SELECT owner_user_id INTO v_owner FROM public.giveting_campaigns WHERE id = NEW.campaign_id;
  IF v_owner IS NOT NULL THEN
    INSERT INTO public.giveting_campaign_events (campaign_id, owner_user_id, event_type, actor_user_id, metadata)
    VALUES (NEW.campaign_id, v_owner, 'donation', NEW.donor_user_id, jsonb_build_object(
      'donation_id', NEW.id, 'amount_minor', NEW.amount_minor, 'currency', NEW.currency,
      'is_anonymous', NEW.is_anonymous
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_giveting_donation_audit ON public.giveting_donations;
CREATE TRIGGER trg_giveting_donation_audit
AFTER INSERT ON public.giveting_donations
FOR EACH ROW EXECUTE FUNCTION public.giveting_log_donation();

CREATE OR REPLACE FUNCTION public.giveting_log_withdrawal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner UUID;
BEGIN
  SELECT owner_user_id INTO v_owner FROM public.giveting_campaigns WHERE id = NEW.campaign_id;
  IF v_owner IS NOT NULL THEN
    INSERT INTO public.giveting_campaign_events (campaign_id, owner_user_id, event_type, actor_user_id, metadata)
    VALUES (NEW.campaign_id, v_owner, 'withdrawal', v_owner, jsonb_build_object(
      'withdrawal_id', NEW.id, 'amount_minor', NEW.amount_minor, 'currency', NEW.currency,
      'status', NEW.status
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_giveting_withdrawal_audit ON public.giveting_withdrawals;
CREATE TRIGGER trg_giveting_withdrawal_audit
AFTER INSERT ON public.giveting_withdrawals
FOR EACH ROW EXECUTE FUNCTION public.giveting_log_withdrawal();

-- 4. Upgraded KYC auto-publish: writes explicit auto_published_kyc event + app_notifications + best-effort email
CREATE OR REPLACE FUNCTION public.giveting_auto_publish_on_kyc_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_email TEXT;
  v_name TEXT;
  v_has_enqueue BOOLEAN;
BEGIN
  IF NEW.status <> 'approved' OR (TG_OP = 'UPDATE' AND OLD.status = 'approved') THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'enqueue_email'
  ) INTO v_has_enqueue;

  SELECT email, COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email,'@',1))
    INTO v_email, v_name FROM auth.users WHERE id = NEW.user_id;

  FOR r IN
    SELECT id, title, slug FROM public.giveting_campaigns
    WHERE owner_user_id = NEW.user_id AND status = 'pending'
    FOR UPDATE
  LOOP
    UPDATE public.giveting_campaigns
      SET status = 'active',
          published_at = COALESCE(published_at, now()),
          updated_at = now()
      WHERE id = r.id;

    -- Explicit audit event with KYC linkage
    INSERT INTO public.giveting_campaign_events (
      campaign_id, owner_user_id, event_type, from_status, to_status,
      actor_user_id, actor_role, reason, metadata
    ) VALUES (
      r.id, NEW.user_id, 'auto_published_kyc', 'pending', 'active',
      NEW.user_id, 'system', 'KYC verification approved',
      jsonb_build_object('kyc_verification_id', NEW.id, 'approved_at', now())
    );

    -- In-app notification (idempotent per campaign)
    INSERT INTO public.app_notifications (user_id, type, title, message, icon, metadata, idempotency_key)
    VALUES (
      NEW.user_id, 'success', 'Your fundraiser is live',
      format('"%s" is now published and can accept donations.', r.title),
      'heart',
      jsonb_build_object('campaign_id', r.id, 'slug', r.slug, 'route', '/app/giveting/c/'||r.slug),
      'giveting-live-'||r.id::text
    )
    ON CONFLICT (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

    -- Best-effort email
    IF v_has_enqueue AND v_email IS NOT NULL THEN
      BEGIN
        PERFORM public.enqueue_email(
          'transactional_emails',
          jsonb_build_object(
            'templateName', 'giveting-campaign-live',
            'recipientEmail', v_email,
            'idempotencyKey', 'giveting-live-'||r.id::text,
            'templateData', jsonb_build_object(
              'name', v_name,
              'title', r.title,
              'campaignUrl', '/app/giveting/c/'||r.slug
            )
          )
        );
      EXCEPTION WHEN OTHERS THEN
        -- do not fail KYC approval on email queue error
        NULL;
      END;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- 5. Backfill audit events for legacy campaigns that never got a 'created' event
INSERT INTO public.giveting_campaign_events (campaign_id, owner_user_id, event_type, to_status, actor_user_id, created_at)
SELECT c.id, c.owner_user_id, 'created', c.status, c.owner_user_id, c.created_at
FROM public.giveting_campaigns c
WHERE NOT EXISTS (
  SELECT 1 FROM public.giveting_campaign_events e WHERE e.campaign_id = c.id AND e.event_type = 'created'
);
