-- BYO Payment Connectors: tenant-scoped credentials for direct mobile-money rails
-- Additive only. Default Flutterwave path remains unchanged.

CREATE TYPE public.tenant_connector_owner_type AS ENUM ('institution', 'merchant', 'developer');
CREATE TYPE public.tenant_connector_id AS ENUM ('mtn_momo', 'orange_money', 'flutterwave');
CREATE TYPE public.tenant_connector_environment AS ENUM ('sandbox', 'live');
CREATE TYPE public.tenant_connector_health AS ENUM ('unknown', 'healthy', 'degraded', 'unhealthy');

CREATE TABLE public.tenant_payment_connectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_type public.tenant_connector_owner_type NOT NULL,
  owner_id UUID NOT NULL,
  connector_id public.tenant_connector_id NOT NULL,
  environment public.tenant_connector_environment NOT NULL DEFAULT 'sandbox',
  country TEXT NOT NULL DEFAULT 'CM',
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 100,
  credentials_encrypted JSONB NOT NULL,
  display_name TEXT,
  health_status public.tenant_connector_health NOT NULL DEFAULT 'unknown',
  last_health_check_at TIMESTAMPTZ,
  last_health_error TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  auto_disabled_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_type, owner_id, connector_id, environment, country)
);

CREATE INDEX idx_tenant_connectors_owner
  ON public.tenant_payment_connectors (owner_type, owner_id, enabled, priority);
CREATE INDEX idx_tenant_connectors_country
  ON public.tenant_payment_connectors (country, connector_id, enabled);

ALTER TABLE public.tenant_payment_connectors ENABLE ROW LEVEL SECURITY;

-- Owner-scoped helper: returns true if the auth user owns the row
CREATE OR REPLACE FUNCTION public.is_tenant_connector_owner(
  _user_id UUID,
  _owner_type public.tenant_connector_owner_type,
  _owner_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _owner_type = 'developer' THEN
    RETURN _user_id = _owner_id;
  ELSIF _owner_type = 'institution' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.institutions
      WHERE id = _owner_id AND user_id = _user_id
    ) OR public.is_institution_staff_admin(_user_id, _owner_id);
  ELSIF _owner_type = 'merchant' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.gateway_merchants
      WHERE id = _owner_id AND user_id = _user_id
    );
  END IF;
  RETURN false;
END;
$$;

-- RLS: owners manage their own; admins read-all
CREATE POLICY "Owners view own connectors"
  ON public.tenant_payment_connectors FOR SELECT
  USING (public.is_tenant_connector_owner(auth.uid(), owner_type, owner_id));

CREATE POLICY "Admins view all connectors"
  ON public.tenant_payment_connectors FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners insert own connectors"
  ON public.tenant_payment_connectors FOR INSERT
  WITH CHECK (public.is_tenant_connector_owner(auth.uid(), owner_type, owner_id));

CREATE POLICY "Owners update own connectors"
  ON public.tenant_payment_connectors FOR UPDATE
  USING (public.is_tenant_connector_owner(auth.uid(), owner_type, owner_id));

CREATE POLICY "Owners delete own connectors"
  ON public.tenant_payment_connectors FOR DELETE
  USING (public.is_tenant_connector_owner(auth.uid(), owner_type, owner_id));

-- Touch updated_at
CREATE TRIGGER trg_tenant_connectors_updated_at
  BEFORE UPDATE ON public.tenant_payment_connectors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Audit trigger
CREATE OR REPLACE FUNCTION public.audit_tenant_connector_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_id UUID;
  v_details JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'tenant_connector.created';
    v_id := NEW.id;
    v_details := jsonb_build_object(
      'owner_type', NEW.owner_type, 'owner_id', NEW.owner_id,
      'connector_id', NEW.connector_id, 'environment', NEW.environment,
      'country', NEW.country
    );
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'tenant_connector.updated';
    v_id := NEW.id;
    v_details := jsonb_build_object(
      'enabled', NEW.enabled, 'priority', NEW.priority,
      'health_status', NEW.health_status
    );
  ELSE
    v_action := 'tenant_connector.deleted';
    v_id := OLD.id;
    v_details := jsonb_build_object(
      'owner_type', OLD.owner_type, 'connector_id', OLD.connector_id
    );
  END IF;

  PERFORM public.log_audit_event(v_action, 'tenant_payment_connector', v_id, v_details);
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_tenant_connectors_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.tenant_payment_connectors
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_tenant_connector_change();