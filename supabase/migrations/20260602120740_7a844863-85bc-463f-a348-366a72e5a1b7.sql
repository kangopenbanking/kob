
-- ============================================================
-- DAILY NEEDS FOUNDATION — Food & Pharmacy marketplace
-- Fully additive. No existing tables modified.
-- ============================================================

-- ENUMS
CREATE TYPE public.dn_vertical AS ENUM ('food', 'pharmacy');
CREATE TYPE public.dn_store_status AS ENUM ('draft', 'active', 'paused', 'suspended');
CREATE TYPE public.dn_order_status AS ENUM (
  'received','accepted','preparing','ready','picked_up','on_the_way','arriving','delivered','cancelled','refunded'
);
CREATE TYPE public.dn_prescription_status AS ENUM ('pending','approved','rejected');
CREATE TYPE public.dn_escrow_status AS ENUM ('held','released','refunded');

-- updated_at helper (reuse if exists)
CREATE OR REPLACE FUNCTION public.dn_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ============================================================
-- STORES
-- ============================================================
CREATE TABLE public.daily_needs_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  vertical public.dn_vertical NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  status public.dn_store_status NOT NULL DEFAULT 'draft',
  contact_phone TEXT,
  address TEXT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  delivery_radius_km NUMERIC(5,2) NOT NULL DEFAULT 5,
  preparation_time_min INT NOT NULL DEFAULT 20,
  opening_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'native' CHECK (source IN ('native','woocommerce')),
  rating NUMERIC(3,2),
  rating_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dn_stores_merchant ON public.daily_needs_stores(merchant_id);
CREATE INDEX idx_dn_stores_vertical_status ON public.daily_needs_stores(vertical, status);
CREATE INDEX idx_dn_stores_location ON public.daily_needs_stores(latitude, longitude);

GRANT SELECT ON public.daily_needs_stores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_needs_stores TO authenticated;
GRANT ALL ON public.daily_needs_stores TO service_role;
ALTER TABLE public.daily_needs_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active stores" ON public.daily_needs_stores
  FOR SELECT USING (status = 'active' OR EXISTS (SELECT 1 FROM public.gateway_merchants gm WHERE gm.id = merchant_id AND gm.user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Merchants manage own stores" ON public.daily_needs_stores
  FOR ALL USING (EXISTS (SELECT 1 FROM public.gateway_merchants gm WHERE gm.id = merchant_id AND gm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.gateway_merchants gm WHERE gm.id = merchant_id AND gm.user_id = auth.uid()));
CREATE POLICY "Admins full access stores" ON public.daily_needs_stores
  FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_dn_stores_updated BEFORE UPDATE ON public.daily_needs_stores
  FOR EACH ROW EXECUTE FUNCTION public.dn_touch_updated_at();

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE public.daily_needs_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.daily_needs_stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dn_cats_store ON public.daily_needs_categories(store_id, position);

GRANT SELECT ON public.daily_needs_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_needs_categories TO authenticated;
GRANT ALL ON public.daily_needs_categories TO service_role;
ALTER TABLE public.daily_needs_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View categories of active stores" ON public.daily_needs_categories
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.daily_needs_stores s WHERE s.id = store_id AND (s.status='active' OR EXISTS (SELECT 1 FROM public.gateway_merchants gm WHERE gm.id=s.merchant_id AND gm.user_id=auth.uid()) OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "Merchants manage own categories" ON public.daily_needs_categories
  FOR ALL USING (EXISTS (SELECT 1 FROM public.daily_needs_stores s JOIN public.gateway_merchants gm ON gm.id=s.merchant_id WHERE s.id=store_id AND gm.user_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.daily_needs_stores s JOIN public.gateway_merchants gm ON gm.id=s.merchant_id WHERE s.id=store_id AND gm.user_id=auth.uid()));

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE public.daily_needs_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.daily_needs_stores(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.daily_needs_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_xaf BIGINT NOT NULL CHECK (price_xaf >= 0),
  stock INT,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  -- pharmacy-specific
  is_otc BOOLEAN NOT NULL DEFAULT TRUE,
  requires_prescription BOOLEAN NOT NULL DEFAULT FALSE,
  -- food-specific / generic
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  woo_product_id BIGINT,
  source TEXT NOT NULL DEFAULT 'native' CHECK (source IN ('native','woocommerce')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dn_products_store ON public.daily_needs_products(store_id);
CREATE INDEX idx_dn_products_category ON public.daily_needs_products(category_id);
CREATE INDEX idx_dn_products_search ON public.daily_needs_products USING GIN (to_tsvector('simple', name || ' ' || COALESCE(description,'')));

GRANT SELECT ON public.daily_needs_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_needs_products TO authenticated;
GRANT ALL ON public.daily_needs_products TO service_role;
ALTER TABLE public.daily_needs_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View available products" ON public.daily_needs_products
  FOR SELECT USING (is_available = true OR EXISTS (SELECT 1 FROM public.daily_needs_stores s JOIN public.gateway_merchants gm ON gm.id=s.merchant_id WHERE s.id=store_id AND gm.user_id=auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Merchants manage own products" ON public.daily_needs_products
  FOR ALL USING (EXISTS (SELECT 1 FROM public.daily_needs_stores s JOIN public.gateway_merchants gm ON gm.id=s.merchant_id WHERE s.id=store_id AND gm.user_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.daily_needs_stores s JOIN public.gateway_merchants gm ON gm.id=s.merchant_id WHERE s.id=store_id AND gm.user_id=auth.uid()));

CREATE TRIGGER trg_dn_products_updated BEFORE UPDATE ON public.daily_needs_products
  FOR EACH ROW EXECUTE FUNCTION public.dn_touch_updated_at();

-- ============================================================
-- PRODUCT IMAGES
-- ============================================================
CREATE TABLE public.daily_needs_product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.daily_needs_products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dn_images_product ON public.daily_needs_product_images(product_id, position);

GRANT SELECT ON public.daily_needs_product_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_needs_product_images TO authenticated;
GRANT ALL ON public.daily_needs_product_images TO service_role;
ALTER TABLE public.daily_needs_product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View product images" ON public.daily_needs_product_images
  FOR SELECT USING (true);
CREATE POLICY "Merchants manage own product images" ON public.daily_needs_product_images
  FOR ALL USING (EXISTS (SELECT 1 FROM public.daily_needs_products p JOIN public.daily_needs_stores s ON s.id=p.store_id JOIN public.gateway_merchants gm ON gm.id=s.merchant_id WHERE p.id=product_id AND gm.user_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.daily_needs_products p JOIN public.daily_needs_stores s ON s.id=p.store_id JOIN public.gateway_merchants gm ON gm.id=s.merchant_id WHERE p.id=product_id AND gm.user_id=auth.uid()));

-- ============================================================
-- CARTS
-- ============================================================
CREATE TABLE public.daily_needs_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES public.daily_needs_stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, store_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_needs_carts TO authenticated;
GRANT ALL ON public.daily_needs_carts TO service_role;
ALTER TABLE public.daily_needs_carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own cart" ON public.daily_needs_carts
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_dn_carts_updated BEFORE UPDATE ON public.daily_needs_carts
  FOR EACH ROW EXECUTE FUNCTION public.dn_touch_updated_at();

CREATE TABLE public.daily_needs_cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES public.daily_needs_carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.daily_needs_products(id) ON DELETE CASCADE,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price_xaf BIGINT NOT NULL CHECK (unit_price_xaf >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dn_cart_items_cart ON public.daily_needs_cart_items(cart_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_needs_cart_items TO authenticated;
GRANT ALL ON public.daily_needs_cart_items TO service_role;
ALTER TABLE public.daily_needs_cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own cart items" ON public.daily_needs_cart_items
  FOR ALL USING (EXISTS (SELECT 1 FROM public.daily_needs_carts c WHERE c.id=cart_id AND c.user_id=auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.daily_needs_carts c WHERE c.id=cart_id AND c.user_id=auth.uid()));

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE public.daily_needs_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES public.daily_needs_stores(id),
  status public.dn_order_status NOT NULL DEFAULT 'received',
  subtotal_xaf BIGINT NOT NULL CHECK (subtotal_xaf >= 0),
  delivery_fee_xaf BIGINT NOT NULL DEFAULT 0,
  service_fee_xaf BIGINT NOT NULL DEFAULT 0,
  total_xaf BIGINT NOT NULL CHECK (total_xaf >= 0),
  currency TEXT NOT NULL DEFAULT 'XAF',
  charge_id UUID,
  escrow_status public.dn_escrow_status NOT NULL DEFAULT 'held',
  delivery_address TEXT NOT NULL,
  delivery_latitude NUMERIC(9,6),
  delivery_longitude NUMERIC(9,6),
  delivery_phone TEXT,
  delivery_code TEXT NOT NULL DEFAULT lpad((floor(random()*10000))::int::text, 4, '0'),
  prescription_url TEXT,
  prescription_status public.dn_prescription_status,
  idempotency_key UUID NOT NULL UNIQUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ
);
CREATE INDEX idx_dn_orders_user ON public.daily_needs_orders(user_id, created_at DESC);
CREATE INDEX idx_dn_orders_store ON public.daily_needs_orders(store_id, created_at DESC);
CREATE INDEX idx_dn_orders_status ON public.daily_needs_orders(status);

GRANT SELECT, INSERT, UPDATE ON public.daily_needs_orders TO authenticated;
GRANT ALL ON public.daily_needs_orders TO service_role;
ALTER TABLE public.daily_needs_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own orders" ON public.daily_needs_orders
  FOR SELECT USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.daily_needs_stores s JOIN public.gateway_merchants gm ON gm.id=s.merchant_id WHERE s.id=store_id AND gm.user_id=auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users create own orders" ON public.daily_needs_orders
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Merchants update own orders" ON public.daily_needs_orders
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.daily_needs_stores s JOIN public.gateway_merchants gm ON gm.id=s.merchant_id WHERE s.id=store_id AND gm.user_id=auth.uid()) OR user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_dn_orders_updated BEFORE UPDATE ON public.daily_needs_orders
  FOR EACH ROW EXECUTE FUNCTION public.dn_touch_updated_at();

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE TABLE public.daily_needs_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.daily_needs_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.daily_needs_products(id),
  name_snapshot TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price_xaf BIGINT NOT NULL CHECK (unit_price_xaf >= 0),
  total_xaf BIGINT NOT NULL CHECK (total_xaf >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dn_order_items_order ON public.daily_needs_order_items(order_id);
GRANT SELECT, INSERT ON public.daily_needs_order_items TO authenticated;
GRANT ALL ON public.daily_needs_order_items TO service_role;
ALTER TABLE public.daily_needs_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View order items via order" ON public.daily_needs_order_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.daily_needs_orders o WHERE o.id=order_id AND (o.user_id=auth.uid() OR EXISTS (SELECT 1 FROM public.daily_needs_stores s JOIN public.gateway_merchants gm ON gm.id=s.merchant_id WHERE s.id=o.store_id AND gm.user_id=auth.uid()) OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "Insert order items via own order" ON public.daily_needs_order_items
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.daily_needs_orders o WHERE o.id=order_id AND o.user_id=auth.uid()));

-- ============================================================
-- ORDER STATUS HISTORY (immutable)
-- ============================================================
CREATE TABLE public.daily_needs_order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.daily_needs_orders(id) ON DELETE CASCADE,
  status public.dn_order_status NOT NULL,
  changed_by UUID,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dn_history_order ON public.daily_needs_order_status_history(order_id, created_at);
GRANT SELECT, INSERT ON public.daily_needs_order_status_history TO authenticated;
GRANT ALL ON public.daily_needs_order_status_history TO service_role;
ALTER TABLE public.daily_needs_order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View history via order" ON public.daily_needs_order_status_history
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.daily_needs_orders o WHERE o.id=order_id AND (o.user_id=auth.uid() OR EXISTS (SELECT 1 FROM public.daily_needs_stores s JOIN public.gateway_merchants gm ON gm.id=s.merchant_id WHERE s.id=o.store_id AND gm.user_id=auth.uid()) OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "Insert history via order participation" ON public.daily_needs_order_status_history
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.daily_needs_orders o WHERE o.id=order_id AND (o.user_id=auth.uid() OR EXISTS (SELECT 1 FROM public.daily_needs_stores s JOIN public.gateway_merchants gm ON gm.id=s.merchant_id WHERE s.id=o.store_id AND gm.user_id=auth.uid()) OR public.has_role(auth.uid(),'admin'))));

-- ============================================================
-- DELIVERY ASSIGNMENTS
-- ============================================================
CREATE TABLE public.daily_needs_delivery_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.daily_needs_orders(id) ON DELETE CASCADE,
  trip_id UUID,
  driver_id UUID,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  current_latitude NUMERIC(9,6),
  current_longitude NUMERIC(9,6),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dn_deliveries_driver ON public.daily_needs_delivery_assignments(driver_id);
GRANT SELECT, INSERT, UPDATE ON public.daily_needs_delivery_assignments TO authenticated;
GRANT ALL ON public.daily_needs_delivery_assignments TO service_role;
ALTER TABLE public.daily_needs_delivery_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View delivery via participation" ON public.daily_needs_delivery_assignments
  FOR SELECT USING (driver_id = auth.uid() OR EXISTS (SELECT 1 FROM public.daily_needs_orders o WHERE o.id=order_id AND (o.user_id=auth.uid() OR EXISTS (SELECT 1 FROM public.daily_needs_stores s JOIN public.gateway_merchants gm ON gm.id=s.merchant_id WHERE s.id=o.store_id AND gm.user_id=auth.uid()))) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Drivers update own deliveries" ON public.daily_needs_delivery_assignments
  FOR UPDATE USING (driver_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_dn_delivery_updated BEFORE UPDATE ON public.daily_needs_delivery_assignments
  FOR EACH ROW EXECUTE FUNCTION public.dn_touch_updated_at();

-- ============================================================
-- PRESCRIPTION REVIEWS
-- ============================================================
CREATE TABLE public.daily_needs_prescription_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.daily_needs_orders(id) ON DELETE CASCADE,
  reviewer_id UUID,
  status public.dn_prescription_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE ON public.daily_needs_prescription_reviews TO authenticated;
GRANT ALL ON public.daily_needs_prescription_reviews TO service_role;
ALTER TABLE public.daily_needs_prescription_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View prescription via participation" ON public.daily_needs_prescription_reviews
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.daily_needs_orders o WHERE o.id=order_id AND (o.user_id=auth.uid() OR EXISTS (SELECT 1 FROM public.daily_needs_stores s JOIN public.gateway_merchants gm ON gm.id=s.merchant_id WHERE s.id=o.store_id AND gm.user_id=auth.uid()))) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Pharmacy merchants update prescription" ON public.daily_needs_prescription_reviews
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.daily_needs_orders o JOIN public.daily_needs_stores s ON s.id=o.store_id JOIN public.gateway_merchants gm ON gm.id=s.merchant_id WHERE o.id=order_id AND gm.user_id=auth.uid() AND s.vertical='pharmacy') OR public.has_role(auth.uid(),'admin'));

-- ============================================================
-- REALTIME (for live order tracking)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_needs_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_needs_delivery_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_needs_order_status_history;
