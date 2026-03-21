
-- Trigger: notify ALL admins via app_notifications when a new support conversation is created
CREATE OR REPLACE FUNCTION public.notify_admins_new_support_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_admin RECORD;
  v_dept_name TEXT;
BEGIN
  -- Get department name
  SELECT name INTO v_dept_name FROM support_departments WHERE id = NEW.department_id;

  -- Notify all admin users
  FOR v_admin IN SELECT user_id FROM user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO app_notifications (user_id, type, title, message, icon, metadata)
    VALUES (
      v_admin.user_id,
      'info',
      'New Support Conversation',
      format('New support request: "%s" in %s department', COALESCE(NEW.subject, 'No subject'), COALESCE(v_dept_name, 'Unknown')),
      'support',
      jsonb_build_object(
        'conversation_id', NEW.id,
        'department_id', NEW.department_id,
        'channel', NEW.channel,
        'event_type', 'support_new_conversation'
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_admins_new_support_conversation
  AFTER INSERT ON public.support_conversations
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_support_conversation();
