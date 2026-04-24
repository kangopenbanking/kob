
-- Departments
CREATE TABLE public.support_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  routing_keywords text[] NOT NULL DEFAULT '{}',
  sla_online_minutes integer NOT NULL DEFAULT 15 CHECK (sla_online_minutes BETWEEN 1 AND 1440),
  sla_offline_hours integer NOT NULL DEFAULT 24 CHECK (sla_offline_hours BETWEEN 1 AND 168),
  escalate_after_minutes integer NOT NULL DEFAULT 60 CHECK (escalate_after_minutes BETWEEN 5 AND 10080),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_default_department ON public.support_departments (is_default) WHERE is_default = true;

ALTER TABLE public.support_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active departments" ON public.support_departments
  FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Admins manage departments" ON public.support_departments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_support_departments_updated_at
  BEFORE UPDATE ON public.support_departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults
INSERT INTO public.support_departments (name, description, is_default, routing_keywords)
VALUES
  ('General', 'General enquiries and information', true, ARRAY['help','question','info','general']::text[]),
  ('Billing', 'Payments, invoices, refunds', false, ARRAY['payment','invoice','refund','charge','billing','price','fee']::text[]),
  ('Technical', 'Bugs, errors, integrations', false, ARRAY['error','bug','crash','api','integration','login','password','technical']::text[]),
  ('Compliance', 'KYC, KYB, regulatory', false, ARRAY['kyc','kyb','compliance','document','verification','identity']::text[]);

-- Add fields to support_agents
ALTER TABLE public.support_agents
  ADD COLUMN IF NOT EXISTS is_supervisor boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_concurrent_chats integer NOT NULL DEFAULT 5 CHECK (max_concurrent_chats BETWEEN 1 AND 50);

-- Agent <-> Department membership
CREATE TABLE public.support_agent_departments (
  agent_id uuid NOT NULL REFERENCES public.support_agents(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.support_departments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, department_id)
);
CREATE INDEX idx_sad_dept ON public.support_agent_departments(department_id);
ALTER TABLE public.support_agent_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage agent depts" ON public.support_agent_departments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Agents read own depts" ON public.support_agent_departments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_agents a WHERE a.id = agent_id AND a.user_id = auth.uid()));

-- Conversation enrichments
ALTER TABLE public.support_conversations
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.support_departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_response_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_escalation_due_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_sc_dept ON public.support_conversations(department_id);
CREATE INDEX IF NOT EXISTS idx_sc_assigned ON public.support_conversations(assigned_agent_id);

-- Audit log for transfer / escalate / claim / assign
CREATE TABLE public.support_conversation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('assigned','claimed','transferred','escalated','reassigned','closed','reopened','dept_changed','priority_changed')),
  actor_user_id uuid,
  actor_name text,
  from_agent_id uuid,
  to_agent_id uuid,
  from_department_id uuid,
  to_department_id uuid,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sce_conv ON public.support_conversation_events(conversation_id, created_at DESC);
ALTER TABLE public.support_conversation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read events" ON public.support_conversation_events
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert events" ON public.support_conversation_events
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Helper: pick department by routing keywords against subject + first message
CREATE OR REPLACE FUNCTION public.support_route_department(p_text text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_text text := lower(coalesce(p_text, ''));
  v_dept_id uuid;
BEGIN
  IF length(v_text) > 0 THEN
    SELECT d.id INTO v_dept_id
    FROM public.support_departments d
    WHERE d.is_active = true
      AND EXISTS (
        SELECT 1 FROM unnest(d.routing_keywords) k
        WHERE position(lower(k) IN v_text) > 0
      )
    ORDER BY d.is_default ASC, d.created_at ASC
    LIMIT 1;
  END IF;
  IF v_dept_id IS NULL THEN
    SELECT id INTO v_dept_id FROM public.support_departments
    WHERE is_active = true AND is_default = true LIMIT 1;
  END IF;
  RETURN v_dept_id;
END;
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversation_events;
