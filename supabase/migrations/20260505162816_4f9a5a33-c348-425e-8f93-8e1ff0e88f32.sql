-- Enforce: every user has exactly ONE primary dashboard role.
-- Dashboard roles are mutually exclusive: personal | merchant | developer | institution | staff | tpp
-- Admin / moderator / support_agent remain orthogonal grants.

CREATE OR REPLACE FUNCTION public.enforce_single_primary_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  primary_roles app_role[] := ARRAY['personal','merchant','developer','institution','staff','tpp']::app_role[];
BEGIN
  IF NEW.role = ANY(primary_roles) THEN
    DELETE FROM public.user_roles
    WHERE user_id = NEW.user_id
      AND role = ANY(primary_roles)
      AND role <> NEW.role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_primary_role ON public.user_roles;
CREATE TRIGGER trg_enforce_single_primary_role
BEFORE INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_single_primary_role();

-- One-time backfill: collapse multiple primary dashboard roles down to a
-- single one based on profiles.account_type. Admin/moderator/support_agent
-- grants are preserved.
CREATE OR REPLACE FUNCTION public.backfill_single_primary_role()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  desired app_role;
  primary_roles app_role[] := ARRAY['personal','merchant','developer','institution','staff','tpp']::app_role[];
BEGIN
  FOR r IN
    SELECT ur.user_id, array_agg(ur.role::text) AS roles, p.account_type
    FROM public.user_roles ur
    LEFT JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = ANY(primary_roles)
    GROUP BY ur.user_id, p.account_type
    HAVING COUNT(*) > 1
  LOOP
    -- Pick the desired role from account_type, falling back by priority.
    desired := CASE lower(coalesce(r.account_type,''))
      WHEN 'merchant' THEN 'merchant'::app_role
      WHEN 'business' THEN 'merchant'::app_role
      WHEN 'developer' THEN 'developer'::app_role
      WHEN 'institution' THEN 'institution'::app_role
      WHEN 'bank' THEN 'institution'::app_role
      WHEN 'fi' THEN 'institution'::app_role
      WHEN 'personal' THEN 'personal'::app_role
      ELSE NULL
    END;

    IF desired IS NULL THEN
      -- Priority order if account_type doesn't map: institution > merchant > developer > staff > tpp > personal
      desired := CASE
        WHEN 'institution' = ANY(r.roles) THEN 'institution'::app_role
        WHEN 'merchant'    = ANY(r.roles) THEN 'merchant'::app_role
        WHEN 'developer'   = ANY(r.roles) THEN 'developer'::app_role
        WHEN 'staff'       = ANY(r.roles) THEN 'staff'::app_role
        WHEN 'tpp'         = ANY(r.roles) THEN 'tpp'::app_role
        ELSE 'personal'::app_role
      END;
    END IF;

    -- Remove other primary roles for this user.
    DELETE FROM public.user_roles
    WHERE user_id = r.user_id
      AND role = ANY(primary_roles)
      AND role <> desired;

    -- Ensure the desired role exists.
    INSERT INTO public.user_roles (user_id, role)
    VALUES (r.user_id, desired)
    ON CONFLICT (user_id, role) DO NOTHING;
  END LOOP;
END;
$$;

SELECT public.backfill_single_primary_role();