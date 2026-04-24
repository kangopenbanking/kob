-- Trigger: notify on new support_messages
CREATE OR REPLACE FUNCTION public.notify_support_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv record;
  v_user_id uuid;
  v_agent_user_id uuid;
BEGIN
  SELECT id, guest_name, guest_email, subject, assigned_agent_id, department_id, guest_token
    INTO v_conv FROM public.support_conversations WHERE id = NEW.conversation_id;
  IF v_conv IS NULL THEN RETURN NEW; END IF;

  -- Agent replied -> notify the guest user (only if they're a registered user with matching email)
  IF NEW.sender_type = 'agent' THEN
    SELECT id INTO v_user_id FROM public.profiles WHERE lower(email) = lower(v_conv.guest_email) LIMIT 1;
    IF v_user_id IS NOT NULL THEN
      INSERT INTO public.app_notifications (user_id, type, title, message, icon, metadata)
      VALUES (
        v_user_id, 'info',
        'New reply from support',
        COALESCE(NEW.sender_name, 'Support agent') || ' replied: ' || left(NEW.content, 140),
        'info',
        jsonb_build_object(
          'event_type', 'support_agent_reply',
          'conversation_id', v_conv.id,
          'guest_token', v_conv.guest_token
        )
      );
    END IF;
  END IF;

  -- Guest sent a message -> notify the assigned agent (if any)
  IF NEW.sender_type = 'guest' AND v_conv.assigned_agent_id IS NOT NULL THEN
    SELECT user_id INTO v_agent_user_id FROM public.support_agents WHERE id = v_conv.assigned_agent_id;
    IF v_agent_user_id IS NOT NULL THEN
      INSERT INTO public.app_notifications (user_id, type, title, message, icon, metadata)
      VALUES (
        v_agent_user_id, 'info',
        'New customer message',
        v_conv.guest_name || ': ' || left(NEW.content, 140),
        'info',
        jsonb_build_object(
          'event_type', 'support_guest_reply',
          'conversation_id', v_conv.id
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_support_message ON public.support_messages;
CREATE TRIGGER trg_notify_support_message
AFTER INSERT ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_support_message();

-- Trigger: notify all eligible department agents on new conversation
CREATE OR REPLACE FUNCTION public.notify_support_new_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_ids uuid[];
BEGIN
  IF NEW.department_id IS NULL THEN
    SELECT array_agg(DISTINCT sa.user_id) INTO v_user_ids
    FROM public.support_agents sa
    WHERE sa.is_active = true;
  ELSE
    SELECT array_agg(DISTINCT sa.user_id) INTO v_user_ids
    FROM public.support_agents sa
    JOIN public.support_agent_departments sad ON sad.agent_id = sa.id
    WHERE sad.department_id = NEW.department_id AND sa.is_active = true;
  END IF;

  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.app_notifications (user_id, type, title, message, icon, metadata)
  SELECT
    uid, 'info',
    'New support chat',
    COALESCE(NEW.subject, 'New conversation') || ' from ' || NEW.guest_name,
    'info',
    jsonb_build_object(
      'event_type', 'support_new_chat',
      'conversation_id', NEW.id,
      'priority', NEW.priority
    )
  FROM unnest(v_user_ids) AS uid;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_support_new_conversation ON public.support_conversations;
CREATE TRIGGER trg_notify_support_new_conversation
AFTER INSERT ON public.support_conversations
FOR EACH ROW EXECUTE FUNCTION public.notify_support_new_conversation();