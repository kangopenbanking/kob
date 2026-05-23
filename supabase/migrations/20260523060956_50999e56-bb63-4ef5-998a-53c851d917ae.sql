
DO $$ BEGIN
  CREATE TYPE public.bottom_nav_app AS ENUM ('customer', 'business', 'banking');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.bottom_nav_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app public.bottom_nav_app NOT NULL,
  label TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Circle',
  path TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  is_center BOOLEAN NOT NULL DEFAULT false,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  badge_key TEXT,
  required_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bottom_nav_app_position
  ON public.bottom_nav_items (app, position);

ALTER TABLE public.bottom_nav_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view enabled bottom nav items" ON public.bottom_nav_items;
CREATE POLICY "Anyone can view enabled bottom nav items"
  ON public.bottom_nav_items FOR SELECT
  USING (is_enabled = true OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert bottom nav items" ON public.bottom_nav_items;
CREATE POLICY "Admins can insert bottom nav items"
  ON public.bottom_nav_items FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update bottom nav items" ON public.bottom_nav_items;
CREATE POLICY "Admins can update bottom nav items"
  ON public.bottom_nav_items FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete bottom nav items" ON public.bottom_nav_items;
CREATE POLICY "Admins can delete bottom nav items"
  ON public.bottom_nav_items FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_bottom_nav_updated_at ON public.bottom_nav_items;
CREATE TRIGGER trg_bottom_nav_updated_at
  BEFORE UPDATE ON public.bottom_nav_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults if empty
INSERT INTO public.bottom_nav_items (app, label, icon, path, position, is_center, is_enabled)
SELECT * FROM (VALUES
  ('customer'::public.bottom_nav_app, 'Home',     'Home',      '/app/home',            0, false, true),
  ('customer'::public.bottom_nav_app, 'Activity', 'Activity',  '/app/activity',        1, false, true),
  ('customer'::public.bottom_nav_app, 'Budget',   'PieChart',  '/app/budget',          2, false, true),
  ('customer'::public.bottom_nav_app, 'Scan',     'ScanLine',  '/app/scan',            3, true,  true),
  ('customer'::public.bottom_nav_app, 'Accounts', 'CreditCard','/app/linked-accounts', 4, false, true),
  ('customer'::public.bottom_nav_app, 'More',     'Menu',      '/app/more',            5, false, true)
) AS v(app, label, icon, path, position, is_center, is_enabled)
WHERE NOT EXISTS (SELECT 1 FROM public.bottom_nav_items WHERE app = 'customer');
