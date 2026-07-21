-- WIPE LEGACY LIVE SUPPORT
DROP TABLE IF EXISTS public.support_messages CASCADE;
DROP TABLE IF EXISTS public.support_conversations CASCADE;
DROP TABLE IF EXISTS public.support_agent_presence_events CASCADE;
DROP TABLE IF EXISTS public.support_agent_presence CASCADE;
DROP TABLE IF EXISTS public.support_audit_logs CASCADE;
DROP TABLE IF EXISTS public.support_rate_limits CASCADE;
DROP TABLE IF EXISTS public.support_agents CASCADE;
DROP TABLE IF EXISTS public.support_departments CASCADE;

-- NEW SCHEMA
CREATE TABLE public.support_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage agents" ON public.support_agents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Agents view own row" ON public.support_agents FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE public.support_business_hours (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  timezone text NOT NULL DEFAULT 'UTC',
  start_hour smallint NOT NULL DEFAULT 8 CHECK (start_hour BETWEEN 0 AND 23),
  end_hour smallint NOT NULL DEFAULT 20 CHECK (end_hour BETWEEN 1 AND 24),
  active_days smallint[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::smallint[],
  offline_message text NOT NULL DEFAULT 'Thanks for reaching out! Our team responds within 15 minutes during business hours, and within 24 hours otherwise. We''ll get back to you shortly.',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_business_hours ENABLE ROW LEVEL SECURITY;
INSERT INTO public.support_business_hours (id) VALUES (1);
CREATE POLICY "Anyone reads business hours" ON public.support_business_hours FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins update business hours" ON public.support_business_hours FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.support_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  guest_name text NOT NULL,
  guest_email text NOT NULL,
  subject text,
  source text NOT NULL DEFAULT 'web',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  assigned_agent_id uuid REFERENCES public.support_agents(id) ON DELETE SET NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sc_status_last ON public.support_conversations(status, last_message_at DESC);
CREATE INDEX idx_sc_email ON public.support_conversations(guest_email);
CREATE POLICY "Admins read all conversations" ON public.support_conversations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update conversations" ON public.support_conversations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('guest','agent','system')),
  sender_id uuid,
  sender_name text,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sm_conv ON public.support_messages(conversation_id, created_at);
CREATE POLICY "Admins read all messages" ON public.support_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert messages" ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.support_bump_conversation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.support_conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_support_bump_conversation
AFTER INSERT ON public.support_messages FOR EACH ROW EXECUTE FUNCTION public.support_bump_conversation();

CREATE OR REPLACE FUNCTION public.support_sync_admin_agent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    INSERT INTO public.support_agents (user_id) VALUES (NEW.user_id) ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_support_sync_admin_agent
AFTER INSERT ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.support_sync_admin_agent();

INSERT INTO public.support_agents (user_id)
SELECT user_id FROM public.user_roles WHERE role = 'admin'
ON CONFLICT (user_id) DO NOTHING;

-- CI7: guarded — earliest authoritative membership added in
-- 20260321040418_5fad711d-abaf-4ab1-b8c8-f6f9e08b526a.sql.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'support_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'support_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations;
  END IF;
END
$$;