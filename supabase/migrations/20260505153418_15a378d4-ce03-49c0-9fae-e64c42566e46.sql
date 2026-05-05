
-- 1) Audit table
CREATE TABLE IF NOT EXISTS public.dashboard_redirect_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_path text NOT NULL,
  reason text NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  is_merchant boolean NOT NULL DEFAULT false,
  is_developer_role boolean NOT NULL DEFAULT false,
  has_developer_org boolean NOT NULL DEFAULT false,
  is_merchant_staff boolean NOT NULL DEFAULT false,
  institution_status text,
  institution_type text,
  is_staff boolean NOT NULL DEFAULT false,
  context text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dra_user ON public.dashboard_redirect_audit(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dra_created ON public.dashboard_redirect_audit(created_at DESC);

ALTER TABLE public.dashboard_redirect_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own redirect audit"
ON public.dashboard_redirect_audit FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users view own redirect audit"
ON public.dashboard_redirect_audit FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins manage all redirect audit"
ON public.dashboard_redirect_audit FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- 2) Backfill: developer_orgs without an institution row
INSERT INTO public.institutions (
  user_id, institution_name, institution_type, registration_number,
  country, address, phone, status, sandbox_access, approved_at, verification_step
)
SELECT
  d.user_id,
  COALESCE(d.name, 'Developer Org'),
  'developer'::institution_type,
  'DEV-' || substr(d.id::text, 1, 8) || '-' || substr(md5(d.id::text),1,6),
  COALESCE(d.country, 'CM'),
  'N/A',
  'N/A',
  'approved'::institution_status,
  true,
  now(),
  'approved'
FROM public.developer_orgs d
WHERE NOT EXISTS (
  SELECT 1 FROM public.institutions i
  WHERE i.user_id = d.user_id AND i.institution_type = 'developer'
)
ON CONFLICT (registration_number) DO NOTHING;

-- Ensure all such users have the developer role
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT d.user_id, 'developer'::app_role
FROM public.developer_orgs d
ON CONFLICT (user_id, role) DO NOTHING;

-- 3) Admin function: list dashboard mismatches
CREATE OR REPLACE FUNCTION public.get_dashboard_mismatches()
RETURNS TABLE (
  user_id uuid,
  email text,
  has_developer_org boolean,
  has_developer_role boolean,
  has_developer_institution boolean,
  has_merchant boolean,
  has_merchant_role boolean,
  has_institution boolean,
  expected_dashboard text,
  issues text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      u.id AS uid,
      u.email::text AS email,
      EXISTS(SELECT 1 FROM developer_orgs d WHERE d.user_id=u.id) AS has_dev_org,
      EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role='developer') AS has_dev_role,
      EXISTS(SELECT 1 FROM institutions i WHERE i.user_id=u.id AND i.institution_type='developer') AS has_dev_inst,
      EXISTS(SELECT 1 FROM gateway_merchants gm WHERE gm.user_id=u.id) AS has_merch,
      EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role='merchant') AS has_merch_role,
      EXISTS(SELECT 1 FROM institutions i WHERE i.user_id=u.id) AS has_inst
    FROM auth.users u
  )
  SELECT
    b.uid, b.email, b.has_dev_org, b.has_dev_role, b.has_dev_inst,
    b.has_merch, b.has_merch_role, b.has_inst,
    CASE
      WHEN b.has_dev_org OR b.has_dev_role OR b.has_dev_inst THEN '/developer'
      WHEN b.has_merch OR b.has_merch_role THEN '/merchant'
      WHEN b.has_inst THEN '/fi-portal'
      ELSE '/credit-score'
    END AS expected_dashboard,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN b.has_dev_org AND NOT b.has_dev_role THEN 'developer_org_missing_role' END,
      CASE WHEN b.has_dev_org AND NOT b.has_dev_inst THEN 'developer_org_missing_institution' END,
      CASE WHEN b.has_dev_role AND NOT b.has_dev_org THEN 'developer_role_missing_org' END,
      CASE WHEN b.has_merch AND NOT b.has_merch_role THEN 'merchant_missing_role' END
    ], NULL) AS issues
  FROM base b
  WHERE
    (b.has_dev_org AND (NOT b.has_dev_role OR NOT b.has_dev_inst))
    OR (b.has_dev_role AND NOT b.has_dev_org)
    OR (b.has_merch AND NOT b.has_merch_role);
END;
$$;

-- 4) One-click repair
CREATE OR REPLACE FUNCTION public.repair_user_routing(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dev_org developer_orgs%ROWTYPE;
  v_merch gateway_merchants%ROWTYPE;
  v_actions text[] := ARRAY[]::text[];
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  SELECT * INTO v_dev_org FROM developer_orgs WHERE user_id=_user_id LIMIT 1;
  IF FOUND THEN
    INSERT INTO user_roles(user_id, role) VALUES (_user_id, 'developer')
      ON CONFLICT DO NOTHING;
    v_actions := array_append(v_actions, 'ensured_developer_role');

    IF NOT EXISTS (SELECT 1 FROM institutions WHERE user_id=_user_id AND institution_type='developer') THEN
      INSERT INTO institutions (
        user_id, institution_name, institution_type, registration_number,
        country, address, phone, status, sandbox_access, approved_at, verification_step
      ) VALUES (
        _user_id, COALESCE(v_dev_org.name,'Developer Org'), 'developer',
        'DEV-' || substr(v_dev_org.id::text,1,8) || '-' || substr(md5(v_dev_org.id::text||now()::text),1,6),
        COALESCE(v_dev_org.country,'CM'),'N/A','N/A','approved',true,now(),'approved'
      );
      v_actions := array_append(v_actions, 'created_developer_institution');
    END IF;
  END IF;

  SELECT * INTO v_merch FROM gateway_merchants WHERE user_id=_user_id LIMIT 1;
  IF FOUND THEN
    INSERT INTO user_roles(user_id, role) VALUES (_user_id, 'merchant')
      ON CONFLICT DO NOTHING;
    v_actions := array_append(v_actions, 'ensured_merchant_role');
  END IF;

  RETURN jsonb_build_object('user_id', _user_id, 'actions', v_actions);
END;
$$;
