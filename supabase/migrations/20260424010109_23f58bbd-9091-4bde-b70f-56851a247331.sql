CREATE OR REPLACE FUNCTION public.notify_support_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_conv record;
  v_user_id uuid;
  v_agent_user_id uuid;
  v_agent_email text;
  v_dept_name text;
  v_supabase_url text := 'https://wdzkzeahdtxlynetndqw.supabase.co';
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indkemt6ZWFoZHR4bHluZXRuZHF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTQ1OTksImV4cCI6MjA4ODQ3MDU5OX0.i-5Sx5xz2ntXQ9mTEfOJ4PQKuaeWRycvbkAQQfx2zYg';
  v_payload jsonb;
BEGIN
  SELECT id, guest_name, guest_email, subject, assigned_agent_id, department_id, guest_token
    INTO v_conv FROM public.support_conversations WHERE id = NEW.conversation_id;
  IF v_conv IS NULL THEN RETURN NEW; END IF;

  IF v_conv.department_id IS NOT NULL THEN
    SELECT name INTO v_dept_name FROM public.support_departments WHERE id = v_conv.department_id;
  END IF;

  -- Agent reply -> notify guest
  IF NEW.sender_type = 'agent' THEN
    SELECT id INTO v_user_id FROM public.profiles WHERE lower(email) = lower(v_conv.guest_email) LIMIT 1;
    IF v_user_id IS NOT NULL THEN
      INSERT INTO public.app_notifications (user_id, type, title, message, icon, metadata)
      VALUES (
        v_user_id, 'info',
        'New reply from support',
        COALESCE(NEW.sender_name, 'Support agent') || ' replied: ' || left(NEW.content, 140),
        'info',
        jsonb_build_object('event_type','support_agent_reply','conversation_id', v_conv.id,'guest_token', v_conv.guest_token)
      );
    END IF;

    IF v_conv.guest_email IS NOT NULL THEN
      v_payload := jsonb_build_object(
        'templateName','support-reply',
        'recipientEmail', v_conv.guest_email,
        'idempotencyKey','support-reply-'||NEW.id::text,
        'templateData', jsonb_build_object(
          'name', v_conv.guest_name,
          'agentName', COALESCE(NEW.sender_name,'Support agent'),
          'messagePreview', left(NEW.content, 280),
          'subject', COALESCE(v_conv.subject,'Support conversation')
        )
      );
      BEGIN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-transactional-email',
          headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_anon_key),
          body := v_payload
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'support email (agent->guest) dispatch failed: %', SQLERRM;
      END;
    END IF;
  END IF;

  -- Guest message -> notify assigned agent
  IF NEW.sender_type = 'guest' AND v_conv.assigned_agent_id IS NOT NULL THEN
    SELECT user_id INTO v_agent_user_id FROM public.support_agents WHERE id = v_conv.assigned_agent_id;
    IF v_agent_user_id IS NOT NULL THEN
      INSERT INTO public.app_notifications (user_id, type, title, message, icon, metadata)
      VALUES (
        v_agent_user_id, 'info',
        'New customer message',
        v_conv.guest_name || ': ' || left(NEW.content, 140),
        'info',
        jsonb_build_object('event_type','support_guest_reply','conversation_id', v_conv.id)
      );

      SELECT email INTO v_agent_email FROM public.profiles WHERE id = v_agent_user_id;
      IF v_agent_email IS NOT NULL THEN
        v_payload := jsonb_build_object(
          'templateName','chat-assigned',
          'recipientEmail', v_agent_email,
          'idempotencyKey','support-guest-msg-'||NEW.id::text,
          'templateData', jsonb_build_object(
            'customerName', v_conv.guest_name,
            'subject', COALESCE(v_conv.subject,'New customer message'),
            'department', COALESCE(v_dept_name,'Support'),
            'priority','medium'
          )
        );
        BEGIN
          PERFORM net.http_post(
            url := v_supabase_url || '/functions/v1/send-transactional-email',
            headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_anon_key),
            body := v_payload
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'support email (guest->agent) dispatch failed: %', SQLERRM;
        END;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;