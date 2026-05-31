
CREATE OR REPLACE FUNCTION public.raise_remittance_abuse_alert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_decision text;
  v_endpoint text;
  v_ip text;
  v_user uuid;
  v_count int;
  v_recent_alert int;
  v_source_label text;
BEGIN
  -- Only act on remittance denials
  IF NEW.event_category IS DISTINCT FROM 'remittance' THEN
    RETURN NEW;
  END IF;

  v_decision := COALESCE(NEW.metadata->>'decision', '');
  IF v_decision NOT LIKE 'denied%' AND v_decision <> 'system_error' THEN
    RETURN NEW;
  END IF;

  v_endpoint := COALESCE(NEW.metadata->>'endpoint', NEW.event_type);
  v_ip := host(NEW.ip_address);
  v_user := NEW.user_id;

  -- Count denials in last 10 min from same user OR same IP
  SELECT count(*) INTO v_count
  FROM public.security_audit_logs
  WHERE event_category = 'remittance'
    AND created_at > now() - interval '10 minutes'
    AND (metadata->>'decision') LIKE 'denied%'
    AND (
      (v_user IS NOT NULL AND user_id = v_user)
      OR (v_ip IS NOT NULL AND host(ip_address) = v_ip)
    );

  IF v_count < 5 THEN
    RETURN NEW;
  END IF;

  -- Cooldown: skip if we already raised a similar alert in the last 5 min
  SELECT count(*) INTO v_recent_alert
  FROM public.system_alerts
  WHERE alert_type = 'remittance_abuse_suspected'
    AND created_at > now() - interval '5 minutes'
    AND (
      (v_user IS NOT NULL AND (details->>'user_id') = v_user::text)
      OR (v_ip IS NOT NULL AND (details->>'ip') = v_ip)
    );

  IF v_recent_alert > 0 THEN
    RETURN NEW;
  END IF;

  v_source_label := COALESCE('user '||v_user::text, 'ip '||v_ip, 'unknown source');

  INSERT INTO public.system_alerts(alert_type, severity, message, details, status)
  VALUES (
    'remittance_abuse_suspected',
    'high',
    format('%s denied remittance requests in 10 min from %s (endpoint: %s)', v_count, v_source_label, v_endpoint),
    jsonb_build_object(
      'user_id', v_user,
      'ip', v_ip,
      'endpoint', v_endpoint,
      'denial_count', v_count,
      'window', '10m',
      'last_decision', v_decision
    ),
    'active'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_raise_remittance_abuse_alert ON public.security_audit_logs;
CREATE TRIGGER trg_raise_remittance_abuse_alert
AFTER INSERT ON public.security_audit_logs
FOR EACH ROW
EXECUTE FUNCTION public.raise_remittance_abuse_alert();
