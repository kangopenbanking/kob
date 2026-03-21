
-- DB trigger: notify user via app_notifications when agent sends a support message
CREATE OR REPLACE FUNCTION public.notify_support_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_subject TEXT;
  v_preview TEXT;
BEGIN
  -- Only fire for agent messages
  IF NEW.sender_type != 'agent' THEN
    RETURN NEW;
  END IF;

  -- Get conversation user_id and subject
  SELECT user_id, subject INTO v_user_id, v_subject
  FROM support_conversations
  WHERE id = NEW.conversation_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_preview := LEFT(COALESCE(NEW.content, 'Sent an attachment'), 100);

  INSERT INTO app_notifications (user_id, type, title, message, icon, metadata)
  VALUES (
    v_user_id,
    'info',
    'New Support Reply',
    format('Re: %s — %s', COALESCE(v_subject, 'Support Chat'), v_preview),
    'support',
    jsonb_build_object(
      'conversation_id', NEW.conversation_id,
      'message_id', NEW.id,
      'event_type', 'support_agent_reply'
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_support_new_message
  AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_support_new_message();

-- Insert managed email types for support
INSERT INTO public.managed_email_types (email_key, name, category, default_subject, default_body_html, description, is_active, sort_order)
VALUES
  ('support_new_conversation', 'Support Conversation Created', 'transactional', 
   'Support Request Received — {{subject}}',
   '<p>Hello {{user_name}},</p><p>We have received your support request: <strong>{{subject}}</strong></p><p>Our team will review and respond shortly. You can track your conversation in the app.</p><p>— KOB Support Team</p>',
   'Email sent when a new support conversation is created', true, 200),
  ('support_agent_reply', 'Support Agent Reply', 'transactional',
   'New Reply to Your Support Request — {{subject}}',
   '<p>Hello {{user_name}},</p><p>You have a new reply on your support request: <strong>{{subject}}</strong></p><p><em>"{{message_preview}}"</em></p><p>Open the app to continue the conversation.</p><p>— KOB Support Team</p>',
   'Email sent when a support agent replies to a conversation', true, 201);
