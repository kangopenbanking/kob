CREATE OR REPLACE FUNCTION public.notify_support_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv RECORD;
  v_agent_user_id uuid;
  v_supabase_url text;
  v_anon_key text;
  v_payload jsonb;
BEGIN
  SELECT id, assigned_agent_id, guest_email, guest_name, subject, department_id
    INTO v_conv
  FROM support_conversations WHERE id = NEW.conversation_id;
  IF v_conv.id IS NULL THEN RETURN NEW; END IF;

  v_supabase_url := 'https://wdzkzeahdtxlynetndqw.supabase.co';
  BEGIN
    SELECT decrypted_secret INTO v_anon_key FROM vault.decrypted_secrets WHERE name='supabase_anon_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_anon_key := NULL; END;

  IF NEW.sender_type = 'agent' THEN
    IF v_conv.guest_email IS NOT NULL AND v_anon_key IS NOT NULL THEN
      v_payload := jsonb_build_object(
        'templateName','support-reply',
        'recipientEmail', v_conv.guest_email,
        'idempotencyKey','support-reply-'||NEW.id::text,
        'templateData', jsonb_build_object(
          'guestName', COALESCE(v_conv.guest_name,'there'),
          'subject', COALESCE(v_conv.subject,'Your support chat'),
          'message', LEFT(NEW.content, 1000)
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
  ELSIF NEW.sender_type = 'guest' THEN
    IF v_conv.assigned_agent_id IS NOT NULL THEN
      SELECT user_id INTO v_agent_user_id FROM support_agents WHERE id = v_conv.assigned_agent_id;
      IF v_agent_user_id IS NOT NULL THEN
        INSERT INTO app_notifications (user_id, type, title, message, icon, metadata, idempotency_key)
        VALUES (
          v_agent_user_id,
          'info',
          'New message from guest',
          LEFT(NEW.content, 140),
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