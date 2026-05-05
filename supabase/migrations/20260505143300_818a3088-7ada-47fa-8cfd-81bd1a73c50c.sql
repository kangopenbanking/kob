
-- ============================================================
-- Auto role assignment on entity creation
-- Standing Order: roles in user_roles only (no privilege escalation).
-- ============================================================

CREATE OR REPLACE FUNCTION public.assign_role_on_entity_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role;
BEGIN
  IF TG_TABLE_NAME = 'gateway_merchants' THEN
    v_role := 'merchant';
  ELSIF TG_TABLE_NAME = 'developer_orgs' THEN
    v_role := 'developer';
  ELSIF TG_TABLE_NAME = 'institutions' THEN
    v_role := 'institution';
  ELSE
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, v_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_merchant_role ON public.gateway_merchants;
CREATE TRIGGER trg_assign_merchant_role
AFTER INSERT ON public.gateway_merchants
FOR EACH ROW EXECUTE FUNCTION public.assign_role_on_entity_insert();

DROP TRIGGER IF EXISTS trg_assign_developer_role ON public.developer_orgs;
CREATE TRIGGER trg_assign_developer_role
AFTER INSERT ON public.developer_orgs
FOR EACH ROW EXECUTE FUNCTION public.assign_role_on_entity_insert();

DROP TRIGGER IF EXISTS trg_assign_institution_role ON public.institutions;
CREATE TRIGGER trg_assign_institution_role
AFTER INSERT ON public.institutions
FOR EACH ROW EXECUTE FUNCTION public.assign_role_on_entity_insert();

-- ============================================================
-- Backfill missing roles
-- ============================================================
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT gm.user_id, 'merchant'::public.app_role
FROM public.gateway_merchants gm
WHERE gm.user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT d.user_id, 'developer'::public.app_role
FROM public.developer_orgs d
WHERE d.user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT i.user_id, 'institution'::public.app_role
FROM public.institutions i
WHERE i.user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT msr.user_id, 'staff'::public.app_role
FROM public.merchant_staff_roles msr
WHERE msr.is_active = true AND msr.user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;
