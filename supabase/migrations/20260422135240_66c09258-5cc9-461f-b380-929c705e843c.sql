-- 1) RLS for support_conversations
DROP POLICY IF EXISTS "Support agents view dept conversations" ON public.support_conversations;
CREATE POLICY "Support agents view dept conversations"
ON public.support_conversations
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'support_agent'::app_role)
  AND (
    department_id IN (SELECT department_id FROM public.support_agents WHERE user_id = auth.uid())
    OR assigned_agent_id IN (SELECT id FROM public.support_agents WHERE user_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Support agents update dept conversations" ON public.support_conversations;
CREATE POLICY "Support agents update dept conversations"
ON public.support_conversations
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'support_agent'::app_role)
  AND department_id IN (SELECT department_id FROM public.support_agents WHERE user_id = auth.uid())
);

-- 2) RLS for support_agents (peers + own status)
DROP POLICY IF EXISTS "Support agents view dept peers" ON public.support_agents;
CREATE POLICY "Support agents view dept peers"
ON public.support_agents
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'support_agent'::app_role)
  AND department_id IN (SELECT department_id FROM public.support_agents WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Support agents update own status" ON public.support_agents;
CREATE POLICY "Support agents update own status"
ON public.support_agents
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 3) RLS for support_messages: agents can read/insert in dept conversations even if unassigned
DROP POLICY IF EXISTS "Support agents view dept messages" ON public.support_messages;
CREATE POLICY "Support agents view dept messages"
ON public.support_messages
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'support_agent'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.support_conversations c
    JOIN public.support_agents sa ON sa.user_id = auth.uid()
    WHERE c.id = support_messages.conversation_id
      AND c.department_id = sa.department_id
  )
);

DROP POLICY IF EXISTS "Support agents send dept messages" ON public.support_messages;
CREATE POLICY "Support agents send dept messages"
ON public.support_messages
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'support_agent'::app_role)
  AND sender_type = 'agent'
  AND EXISTS (
    SELECT 1 FROM public.support_conversations c
    JOIN public.support_agents sa ON sa.user_id = auth.uid()
    WHERE c.id = support_messages.conversation_id
      AND c.department_id = sa.department_id
  )
);

-- 4) Allow agents to view dept (already public for active dept) and read profiles of teammates is via existing policies.

-- 5) Notification trigger: notify support agents in the conversation's department
CREATE OR REPLACE FUNCTION public.notify_support_agents_new_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_agent RECORD;
  v_dept_name TEXT;
BEGIN
  IF NEW.department_id IS NULL THEN RETURN NEW; END IF;
  SELECT name INTO v_dept_name FROM support_departments WHERE id = NEW.department_id;

  FOR v_agent IN
    SELECT user_id FROM support_agents WHERE department_id = NEW.department_id
  LOOP
    INSERT INTO app_notifications (user_id, type, title, message, icon, metadata)
    VALUES (
      v_agent.user_id,
      'info',
      'New Support Chat',
      format('New chat in %s: "%s"', COALESCE(v_dept_name, 'Support'), COALESCE(NEW.subject, 'No subject')),
      'support',
      jsonb_build_object(
        'conversation_id', NEW.id,
        'department_id', NEW.department_id,
        'channel', NEW.channel,
        'event_type', 'support_new_chat_agent'
      )
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_support_agents_new_conv ON public.support_conversations;
CREATE TRIGGER trg_notify_support_agents_new_conv
AFTER INSERT ON public.support_conversations
FOR EACH ROW
EXECUTE FUNCTION public.notify_support_agents_new_conversation();

-- 6) Helper RPC for edge function to fetch agent emails
CREATE OR REPLACE FUNCTION public.get_support_dept_agent_emails(_department_id uuid)
RETURNS TABLE(user_id uuid, email text, full_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sa.user_id, p.email, p.full_name
  FROM support_agents sa
  JOIN profiles p ON p.id = sa.user_id
  WHERE sa.department_id = _department_id
$$;

REVOKE ALL ON FUNCTION public.get_support_dept_agent_emails(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_support_dept_agent_emails(uuid) TO authenticated, service_role;