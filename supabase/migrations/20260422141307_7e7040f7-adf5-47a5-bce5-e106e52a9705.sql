-- 1. Agent presence / heartbeat
CREATE TABLE IF NOT EXISTS public.support_agent_presence (
  agent_id UUID PRIMARY KEY REFERENCES public.support_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online','away','offline')),
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_agent_presence_user ON public.support_agent_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_support_agent_presence_status ON public.support_agent_presence(status);

ALTER TABLE public.support_agent_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents read presence for their dept"
ON public.support_agent_presence FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.support_agents me
    JOIN public.support_agents other ON other.id = support_agent_presence.agent_id
    WHERE me.user_id = auth.uid() AND me.department_id = other.department_id
  )
);

CREATE POLICY "Agents upsert own presence"
ON public.support_agent_presence FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Agents update own presence"
ON public.support_agent_presence FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins manage presence"
ON public.support_agent_presence FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Claim columns + escalation tracking on conversations
ALTER TABLE public.support_conversations
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_by UUID,
  ADD COLUMN IF NOT EXISTS sla_warned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_escalated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_support_conversations_claimed_by ON public.support_conversations(claimed_by);

-- Atomic claim function
CREATE OR REPLACE FUNCTION public.claim_support_conversation(_conversation_id UUID)
RETURNS public.support_conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent public.support_agents%ROWTYPE;
  v_conv public.support_conversations%ROWTYPE;
BEGIN
  SELECT * INTO v_agent FROM public.support_agents WHERE user_id = auth.uid() LIMIT 1;
  IF v_agent.id IS NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_a_support_agent';
  END IF;

  UPDATE public.support_conversations
  SET assigned_agent_id = COALESCE(v_agent.id, assigned_agent_id),
      claimed_by = auth.uid(),
      claimed_at = now(),
      status = CASE WHEN status = 'open' THEN 'assigned' ELSE status END,
      updated_at = now()
  WHERE id = _conversation_id
    AND (assigned_agent_id IS NULL OR claimed_by IS NULL)
  RETURNING * INTO v_conv;

  IF v_conv.id IS NULL THEN
    RAISE EXCEPTION 'conversation_already_claimed';
  END IF;

  INSERT INTO public.support_audit_logs (conversation_id, actor_id, action, details)
  VALUES (v_conv.id, auth.uid(), 'claim', jsonb_build_object('agent_id', v_agent.id));

  RETURN v_conv;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_support_conversation(UUID) TO authenticated;

-- 3. Audit log
CREATE TABLE IF NOT EXISTS public.support_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  actor_id UUID,
  actor_type TEXT NOT NULL DEFAULT 'agent' CHECK (actor_type IN ('agent','admin','system','user')),
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_audit_conv ON public.support_audit_logs(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_audit_actor ON public.support_audit_logs(actor_id);

ALTER TABLE public.support_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage audit logs"
ON public.support_audit_logs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents read audit for accessible chats"
ON public.support_audit_logs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.support_conversations c
    JOIN public.support_agents sa ON sa.user_id = auth.uid()
    WHERE c.id = conversation_id
      AND (c.assigned_agent_id = sa.id OR (c.assigned_agent_id IS NULL AND c.department_id = sa.department_id))
  )
);

CREATE POLICY "Users read audit for own chats"
ON public.support_audit_logs FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.support_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
);

CREATE POLICY "Agents insert audit for accessible chats"
ON public.support_audit_logs FOR INSERT TO authenticated
WITH CHECK (
  actor_id = auth.uid() AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.support_conversations c
      JOIN public.support_agents sa ON sa.user_id = auth.uid()
      WHERE c.id = conversation_id
        AND (c.assigned_agent_id = sa.id OR c.department_id = sa.department_id)
    )
  )
);

-- 4. Managed email test sends
CREATE TABLE IF NOT EXISTS public.managed_email_test_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_key TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  error_message TEXT,
  message_id TEXT,
  sent_by UUID NOT NULL,
  template_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_managed_email_test_sends_recent
  ON public.managed_email_test_sends(created_at DESC);

ALTER TABLE public.managed_email_test_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage email test sends"
ON public.managed_email_test_sends FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Realtime publication adds
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_agent_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_audit_logs;