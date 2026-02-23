
-- Add 'merchant' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'merchant';

-- Create trigger function to auto-assign merchant role when a gateway_merchant is created
CREATE OR REPLACE FUNCTION public.assign_merchant_role_on_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, 'merchant')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Attach trigger to gateway_merchants table
DROP TRIGGER IF EXISTS trg_assign_merchant_role ON public.gateway_merchants;
CREATE TRIGGER trg_assign_merchant_role
  AFTER INSERT ON public.gateway_merchants
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_merchant_role_on_create();
