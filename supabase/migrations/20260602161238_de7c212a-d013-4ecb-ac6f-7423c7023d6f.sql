
-- 1. Favorites
CREATE TABLE IF NOT EXISTS public.daily_needs_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  store_id uuid NOT NULL REFERENCES public.daily_needs_stores(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, store_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_needs_favorites TO authenticated;
GRANT ALL ON public.daily_needs_favorites TO service_role;
ALTER TABLE public.daily_needs_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ddn_fav_owner_all" ON public.daily_needs_favorites
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Promos (store-scoped or global if store_id is null)
CREATE TABLE IF NOT EXISTS public.daily_needs_promos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.daily_needs_stores(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text,
  discount_xaf bigint NOT NULL DEFAULT 0 CHECK (discount_xaf >= 0),
  discount_percent integer CHECK (discount_percent BETWEEN 0 AND 100),
  min_subtotal_xaf bigint NOT NULL DEFAULT 0,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, code)
);
GRANT SELECT ON public.daily_needs_promos TO anon, authenticated;
GRANT ALL ON public.daily_needs_promos TO service_role;
ALTER TABLE public.daily_needs_promos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ddn_promo_public_read" ON public.daily_needs_promos
  FOR SELECT USING (active = true AND (expires_at IS NULL OR expires_at > now()));

-- 3. Reviews
CREATE TABLE IF NOT EXISTS public.daily_needs_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.daily_needs_orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  store_id uuid NOT NULL REFERENCES public.daily_needs_stores(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.daily_needs_reviews TO anon, authenticated;
GRANT INSERT, UPDATE ON public.daily_needs_reviews TO authenticated;
GRANT ALL ON public.daily_needs_reviews TO service_role;
ALTER TABLE public.daily_needs_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ddn_review_public_read" ON public.daily_needs_reviews FOR SELECT USING (true);
CREATE POLICY "ddn_review_owner_write" ON public.daily_needs_reviews
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ddn_review_owner_update" ON public.daily_needs_reviews
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 4. Issue reports
CREATE TABLE IF NOT EXISTS public.daily_needs_issue_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.daily_needs_orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  category text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.daily_needs_issue_reports TO authenticated;
GRANT ALL ON public.daily_needs_issue_reports TO service_role;
ALTER TABLE public.daily_needs_issue_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ddn_issue_owner_rw" ON public.daily_needs_issue_reports
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Driver shifts
CREATE TABLE IF NOT EXISTS public.ddn_driver_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.ddn_drivers(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_minute smallint NOT NULL CHECK (start_minute BETWEEN 0 AND 1440),
  end_minute smallint NOT NULL CHECK (end_minute BETWEEN 0 AND 1440),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ddn_driver_shifts TO authenticated;
GRANT ALL ON public.ddn_driver_shifts TO service_role;
ALTER TABLE public.ddn_driver_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ddn_shift_owner_rw" ON public.ddn_driver_shifts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ddn_drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ddn_drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()));

-- 6. Store quick pause / holiday mode
ALTER TABLE public.daily_needs_stores
  ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paused_reason text,
  ADD COLUMN IF NOT EXISTS paused_until timestamptz;
