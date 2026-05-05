-- Helper view-equivalent: expected dashboard per signal-bearing user
CREATE OR REPLACE FUNCTION public.dashboard_routing_expected_paths()
RETURNS TABLE(id uuid, email text, expected_path text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cohort AS (
    SELECT DISTINCT u.id, u.email
    FROM auth.users u
    WHERE u.id IN (
      SELECT user_id FROM public.developer_orgs
      UNION SELECT user_id FROM public.institutions
      UNION SELECT user_id FROM public.gateway_merchants
      UNION SELECT user_id FROM public.user_roles
        WHERE role IN ('admin','merchant','developer','staff','institution')
    )
  )
  SELECT
    c.id,
    c.email::text,
    CASE
      WHEN public.has_role(c.id,'admin')     THEN '/admin'
      WHEN public.has_role(c.id,'merchant')  THEN '/merchant'
      WHEN public.has_role(c.id,'developer') THEN '/developer'
      WHEN EXISTS(SELECT 1 FROM public.developer_orgs WHERE user_id=c.id) THEN '/developer'
      WHEN (SELECT institution_type FROM public.institutions WHERE user_id=c.id LIMIT 1) = 'developer'
        AND (SELECT status FROM public.institutions WHERE user_id=c.id LIMIT 1) = 'approved' THEN '/developer'
      WHEN (SELECT status FROM public.institutions WHERE user_id=c.id LIMIT 1) = 'approved' THEN '/fi-portal'
      WHEN (SELECT status FROM public.institutions WHERE user_id=c.id LIMIT 1) IS NOT NULL THEN '/pending-approval'
      WHEN public.has_role(c.id,'staff') THEN '/fi-portal'
      ELSE '/credit-score'
    END AS expected_path
  FROM cohort c;
$$;

REVOKE ALL ON FUNCTION public.dashboard_routing_expected_paths() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_routing_expected_paths() TO service_role;

-- Preview which users would gain a role from backfill
CREATE OR REPLACE FUNCTION public.dashboard_routing_backfill_preview()
RETURNS TABLE(user_id uuid, missing_role app_role, source text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.user_id, 'merchant'::app_role, 'gateway_merchants'
  FROM public.gateway_merchants m
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id = m.user_id AND r.role = 'merchant'
  )
  UNION ALL
  SELECT d.user_id, 'developer'::app_role, 'developer_orgs'
  FROM public.developer_orgs d
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id = d.user_id AND r.role = 'developer'
  )
  UNION ALL
  SELECT i.user_id, 'institution'::app_role, 'institutions'
  FROM public.institutions i
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id = i.user_id AND r.role = 'institution'
  );
$$;

REVOKE ALL ON FUNCTION public.dashboard_routing_backfill_preview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_routing_backfill_preview() TO service_role;

-- Apply the backfill (idempotent via ON CONFLICT)
CREATE OR REPLACE FUNCTION public.dashboard_routing_backfill_apply()
RETURNS TABLE(user_id uuid, role_added app_role, source text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH inserted AS (
    INSERT INTO public.user_roles (user_id, role)
    SELECT p.user_id, p.missing_role FROM public.dashboard_routing_backfill_preview() p
    ON CONFLICT (user_id, role) DO NOTHING
    RETURNING user_id, role
  )
  SELECT i.user_id, i.role,
    CASE i.role
      WHEN 'merchant' THEN 'gateway_merchants'
      WHEN 'developer' THEN 'developer_orgs'
      WHEN 'institution' THEN 'institutions'
      ELSE 'unknown'
    END AS source
  FROM inserted i;
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_routing_backfill_apply() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_routing_backfill_apply() TO service_role;