
-- ============================================================
-- LIVE SUPPORT — E2E HARDENING (v1.0.0)
-- ============================================================

-- 1. Schema additions on support_conversations
ALTER TABLE public.support_conversations
  ADD COLUMN IF NOT EXISTS first_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_message_preview text,
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS unread_user_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unread_agent_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sla_target_minutes integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS sla_breach_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_support_conv_status_dept
  ON public.support_conversations (status, department_id);
CREATE INDEX IF NOT EXISTS idx_support_conv_assigned
  ON public.support_conversations (assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_support_msg_conv_created
  ON public.support_messages (conversation_id, created_at);

-- 2. Fix the broken RLS policy on support_conversations
DROP POLICY IF EXISTS "Agents see assigned conversations" ON public.support_conversations;
CREATE POLICY "Agents see assigned or queued in dept"
  ON public.support_conversations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_agents sa
      WHERE sa.user_id = auth.uid()
        AND (
          sa.id = support_conversations.assigned_agent_id
          OR (
            support_conversations.assigned_agent_id IS NULL
            AND sa.department_id = support_conversations.department_id
          )
        )
    )
  );

-- Allow agents to claim queued conversations in their department
DROP POLICY IF EXISTS "Agents update assigned conversations" ON public.support_conversations;
CREATE POLICY "Agents update assigned or queued in dept"
  ON public.support_conversations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.support_agents sa
      WHERE sa.user_id = auth.uid()
        AND (
          sa.id = support_conversations.assigned_agent_id
          OR (
            support_conversations.assigned_agent_id IS NULL
            AND sa.department_id = support_conversations.department_id
          )
        )
    )
  );

-- 3. Mirror fix on support_messages SELECT/INSERT (already correct on SELECT;
--    extend INSERT so an agent in the dept can reply even before claiming).
DROP POLICY IF EXISTS "Agents send messages in assigned conversations" ON public.support_messages;
CREATE POLICY "Agents send messages in own scope"
  ON public.support_messages
  FOR INSERT
  WITH CHECK (
    sender_type = 'agent'
    AND EXISTS (
      SELECT 1 FROM public.support_conversations c
      JOIN public.support_agents sa ON sa.user_id = auth.uid()
      WHERE c.id = support_messages.conversation_id
        AND (
          c.assigned_agent_id = sa.id
          OR (c.assigned_agent_id IS NULL AND c.department_id = sa.department_id)
        )
    )
  );

-- 4. Auto-stamp updated_at on conversations + messages
CREATE OR REPLACE FUNCTION public.support_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_conv_updated ON public.support_conversations;
CREATE TRIGGER trg_support_conv_updated
  BEFORE UPDATE ON public.support_conversations
  FOR EACH ROW EXECUTE FUNCTION public.support_set_updated_at();

-- 5. After a message is inserted, update the parent conversation
CREATE OR REPLACE FUNCTION public.support_after_message_insert()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_preview text;
BEGIN
  v_preview := COALESCE(
    NULLIF(left(regexp_replace(COALESCE(NEW.content, ''), E'[\\n\\r]+', ' ', 'g'), 140), ''),
    CASE WHEN NEW.file_url IS NOT NULL THEN '📎 Attachment' ELSE '' END
  );

  UPDATE public.support_conversations c SET
    last_message_preview = v_preview,
    last_message_at      = NEW.created_at,
    updated_at           = NEW.created_at,
    unread_user_count    = CASE
      WHEN NEW.sender_type = 'agent' THEN c.unread_user_count + 1
      ELSE c.unread_user_count
    END,
    unread_agent_count   = CASE
      WHEN NEW.sender_type = 'user' THEN c.unread_agent_count + 1
      ELSE c.unread_agent_count
    END,
    first_response_at    = CASE
      WHEN NEW.sender_type = 'agent' AND c.first_response_at IS NULL
        THEN NEW.created_at
      ELSE c.first_response_at
    END,
    sla_breach_at        = CASE
      WHEN NEW.sender_type = 'agent' AND c.first_response_at IS NULL
        THEN NULL
      ELSE c.sla_breach_at
    END
  WHERE c.id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_after_message_insert ON public.support_messages;
CREATE TRIGGER trg_support_after_message_insert
  AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.support_after_message_insert();

-- 6. On new conversation, set the SLA breach deadline
CREATE OR REPLACE FUNCTION public.support_before_conversation_insert()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.sla_target_minutes IS NULL THEN
    NEW.sla_target_minutes := 15;
  END IF;
  IF NEW.sla_breach_at IS NULL THEN
    NEW.sla_breach_at := now() + (NEW.sla_target_minutes || ' minutes')::interval;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_before_conv_insert ON public.support_conversations;
CREATE TRIGGER trg_support_before_conv_insert
  BEFORE INSERT ON public.support_conversations
  FOR EACH ROW EXECUTE FUNCTION public.support_before_conversation_insert();

-- 7. Read-receipt helper (RLS-safe; relies on existing policies)
CREATE OR REPLACE FUNCTION public.support_mark_read(p_conversation_id uuid, p_role text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF p_role = 'user' THEN
    UPDATE public.support_messages
       SET read_at = now()
     WHERE conversation_id = p_conversation_id
       AND sender_type = 'agent'
       AND read_at IS NULL;
    UPDATE public.support_conversations
       SET unread_user_count = 0
     WHERE id = p_conversation_id;
  ELSIF p_role = 'agent' THEN
    UPDATE public.support_messages
       SET read_at = now()
     WHERE conversation_id = p_conversation_id
       AND sender_type = 'user'
       AND read_at IS NULL;
    UPDATE public.support_conversations
       SET unread_agent_count = 0
     WHERE id = p_conversation_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.support_mark_read(uuid, text) TO authenticated;

-- 8. Enable Realtime on support tables (idempotent)
-- CI7A: membership-guarded — earliest authoritative additions live in
-- 20260321040418_5fad711d-abaf-4ab1-b8c8-f6f9e08b526a.sql.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'support_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.support_conversations;
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
      AND tablename = 'support_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.support_messages;
  END IF;
END
$$;

ALTER TABLE public.support_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.support_messages       REPLICA IDENTITY FULL;
