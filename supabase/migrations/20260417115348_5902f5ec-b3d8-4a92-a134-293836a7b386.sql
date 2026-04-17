-- F6 remediation: server-side HMAC signing for gateway_webhook_endpoints
-- Mirrors compute_webhook_hmac pattern so endpoint secrets never leave the DB.
CREATE OR REPLACE FUNCTION public.compute_endpoint_hmac(p_endpoint_id uuid, p_payload text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT secret INTO v_secret
  FROM public.gateway_webhook_endpoints
  WHERE id = p_endpoint_id AND is_active = true;

  IF v_secret IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN encode(extensions.hmac(p_payload::bytea, v_secret::bytea, 'sha256'), 'hex');
END;
$function$;

REVOKE ALL ON FUNCTION public.compute_endpoint_hmac(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_endpoint_hmac(uuid, text) TO service_role;