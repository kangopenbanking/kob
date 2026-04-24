-- Add idempotency key to app_notifications
ALTER TABLE public.app_notifications
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Unique per (user_id, idempotency_key) when key is present
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_notifications_user_idem
  ON public.app_notifications (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Update notify_support_new_conversation to set idempotency_key per (conversation, agent)
CREATE OR REPLACE FUNCTION public.notify_support_new_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_ids uuid[];
  v_uid uuid;
BEGIN
  -- Tier 1: agents in the conversation's department
  IF NEW.department_id IS NOT NULL THEN
    SELECT array_agg(DISTINCT sa.user_id) INTO v_user_ids
    FROM support_agent_departments sad
    JOIN support_agents sa ON sa.id = sad.agent_id
    WHERE sad.department_id = NEW.department_id AND sa.is_active = true;
  END IF;

  -- Tier 2: supervisors
  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) IS NULL THEN
    SELECT array_agg(DISTINCT user_id) INTO v_user_ids
    FROM support_agents
    WHERE is_active = true AND is_supervisor = true;
  END IF;

  -- Tier 3: all active agents
  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) IS NULL THEN
    SELECT array_agg(DISTINCT user_id) INTO v_user_ids
    FROM support_agents
    WHERE is_active = true;
  END IF;

  IF v_user_ids IS NOT NULL THEN
    FOREACH v_uid IN ARRAY v_user_ids LOOP
      INSERT INTO app_notifications (user_id, type, title, message, icon, metadata, idempotency_key)
      VALUES (
        v_uid,
        'info',
        'New support conversation',
        COALESCE(NEW.subject, 'A guest started a new chat'),
        'message-circle',
        jsonb_build_object(
          'event_type', 'support_new_conversation',
          'conversation_id', NEW.id,
          'department_id', NEW.department_id,
          'priority', NEW.priority
        ),
        'support_new_conv:' || NEW.id::text
      )
      ON CONFLICT (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Update notify_support_message to use idempotency_key per message
CREATE OR REPLACE FUNCTION public.notify_support_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv RECORD;
  v_agent_user_id uuid;
  v_guest_user_id uuid;
  v_supabase_url text;
  v_anon_key text;
  v_payload jsonb;
BEGIN
  SELECT id, assigned_agent_id, guest_user_id, guest_email, guest_name, subject, department_id
    INTO v_conv
  FROM support_conversations WHERE id = NEW.conversation_id;
  IF v_conv.id IS NULL THEN RETURN NEW; END IF;

  v_supabase_url := 'https://wdzkzeahdtxlynetndqw.supabase.co';
  BEGIN
    SELECT decrypted_secret INTO v_anon_key FROM vault.decrypted_secrets WHERE name='supabase_anon_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_anon_key := NULL; END;

  IF NEW.sender_type = 'agent' THEN
    -- Notify the guest if they have an account
    IF v_conv.guest_user_id IS NOT NULL THEN
      INSERT INTO app_notifications (user_id, type, title, message, icon, metadata, idempotency_key)
      VALUES (
        v_conv.guest_user_id,
        'info',
        'New reply from support',
        LEFT(NEW.body, 140),
        'message-circle',
        jsonb_build_object('event_type','support_agent_reply','conversation_id', v_conv.id, 'message_id', NEW.id),
        'support_msg:' || NEW.id::text
      )
      ON CONFLICT (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
    END IF;

    -- Email the guest
    IF v_conv.guest_email IS NOT NULL AND v_anon_key IS NOT NULL THEN
      v_payload := jsonb_build_object(
        'templateName','support-reply',
        'recipientEmail', v_conv.guest_email,
        'idempotencyKey','support-reply-'||NEW.id::text,
        'templateData', jsonb_build_object(
          'guestName', COALESCE(v_conv.guest_name,'there'),
          'subject', COALESCE(v_conv.subject,'Your support chat'),
          'message', LEFT(NEW.body, 1000)
        )
      );
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-transactional-email',
          headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_anon_key),
          body := v_payload
        );
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;

  ELSE
    -- Guest message → notify assigned agent (or all dept agents if unassigned)
    IF v_conv.assigned_agent_id IS NOT NULL THEN
      SELECT user_id INTO v_agent_user_id FROM support_agents WHERE id = v_conv.assigned_agent_id;
      IF v_agent_user_id IS NOT NULL THEN
        INSERT INTO app_notifications (user_id, type, title, message, icon, metadata, idempotency_key)
        VALUES (
          v_agent_user_id,
          'info',
          'New message from guest',
          LEFT(NEW.body, 140),
          'message-circle',
          jsonb_build_object('event_type','support_guest_reply','conversation_id', v_conv.id, 'message_id', NEW.id),
          'support_msg:' || NEW.id::text
        )
        ON CONFLICT (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;