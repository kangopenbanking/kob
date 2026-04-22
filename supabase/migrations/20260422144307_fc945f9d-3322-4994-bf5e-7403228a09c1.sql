-- Agent presence history for timeline view
CREATE TABLE IF NOT EXISTS public.support_agent_presence_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.support_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  previous_status TEXT,
  status TEXT NOT NULL CHECK (status IN ('online','away','offline')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_presence_events_agent ON public.support_agent_presence_events(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_presence_events_created ON public.support_agent_presence_events(created_at DESC);

ALTER TABLE public.support_agent_presence_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage presence events"
ON public.support_agent_presence_events
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Agents read presence events for their dept"
ON public.support_agent_presence_events
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.support_agents me
    JOIN public.support_agents other ON other.id = support_agent_presence_events.agent_id
    WHERE me.user_id = auth.uid() AND me.department_id = other.department_id
  )
);

CREATE POLICY "Agents insert own presence events"
ON public.support_agent_presence_events
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Trigger: write a history row whenever support_agent_presence status changes
CREATE OR REPLACE FUNCTION public.log_support_presence_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR (NEW.status IS DISTINCT FROM OLD.status) THEN
    INSERT INTO public.support_agent_presence_events (agent_id, user_id, previous_status, status, reason)
    VALUES (
      NEW.agent_id,
      NEW.user_id,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END,
      NEW.status,
      CASE
        WHEN TG_OP = 'INSERT' THEN 'initial_heartbeat'
        WHEN NEW.status = 'offline' AND OLD.status <> 'offline' THEN 'agent_signed_off'
        WHEN NEW.status = 'online' AND OLD.status = 'offline' THEN 'agent_signed_on'
        WHEN NEW.status = 'away' THEN 'idle_or_marked_away'
        WHEN NEW.status = 'online' AND OLD.status = 'away' THEN 'returned_active'
        ELSE 'status_changed'
      END
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_support_presence_change ON public.support_agent_presence;
CREATE TRIGGER trg_log_support_presence_change
AFTER INSERT OR UPDATE ON public.support_agent_presence
FOR EACH ROW EXECUTE FUNCTION public.log_support_presence_change();