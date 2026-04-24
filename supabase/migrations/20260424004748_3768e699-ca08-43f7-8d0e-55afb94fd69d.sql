-- Patch new-conversation notification trigger to fall back to all active agents/supervisors
-- when the routed department has no assigned agents, so tickets are never silently dropped.
CREATE OR REPLACE FUNCTION public.notify_support_new_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Fallback: if no agents are mapped to the routed department, notify supervisors
  -- and (if still empty) all active agents so the chat is never invisible.
  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) IS NULL THEN
    SELECT array_agg(DISTINCT sa.user_id) INTO v_user_ids
    FROM public.support_agents sa
    WHERE sa.is_active = true AND sa.is_supervisor = true;
  END IF;
  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) IS NULL THEN
    SELECT array_agg(DISTINCT sa.user_id) INTO v_user_ids
    FROM public.support_agents sa
    WHERE sa.is_active = true;
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
      'priority', NEW.priority,
      'department_id', NEW.department_id
    )
  FROM unnest(v_user_ids) AS uid;

  RETURN NEW;
END;
$function$;