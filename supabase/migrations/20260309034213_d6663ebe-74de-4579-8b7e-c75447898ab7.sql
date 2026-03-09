
-- 1. Coupons table
CREATE TABLE IF NOT EXISTS pos_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES gateway_merchants(id) ON DELETE CASCADE NOT NULL,
  code TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'percentage',
  value NUMERIC NOT NULL DEFAULT 0,
  min_order_amount NUMERIC DEFAULT 0,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(merchant_id, code)
);

-- 2. Store Reviews
CREATE TABLE IF NOT EXISTS pos_store_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES gateway_merchants(id) ON DELETE CASCADE NOT NULL,
  customer_user_id UUID NOT NULL,
  order_id UUID REFERENCES pos_orders(id),
  rating INTEGER NOT NULL,
  comment TEXT,
  merchant_reply TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validate_review_rating()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_review_rating ON pos_store_reviews;
CREATE TRIGGER trg_validate_review_rating
  BEFORE INSERT OR UPDATE ON pos_store_reviews
  FOR EACH ROW EXECUTE FUNCTION public.validate_review_rating();

-- 3. Feature Flags
CREATE TABLE IF NOT EXISTS business_app_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES gateway_merchants(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(merchant_id, feature_key)
);

-- 4. Notification Preferences
CREATE TABLE IF NOT EXISTS merchant_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES gateway_merchants(id) ON DELETE CASCADE NOT NULL UNIQUE,
  new_order_alert BOOLEAN DEFAULT true,
  low_stock_alert BOOLEAN DEFAULT true,
  review_alert BOOLEAN DEFAULT true,
  cha_ching_sound BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE pos_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_store_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_app_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_notification_preferences ENABLE ROW LEVEL SECURITY;

-- pos_coupons policies
CREATE POLICY "Merchant owner can manage coupons" ON pos_coupons
  FOR ALL TO authenticated
  USING (
    merchant_id IN (SELECT id FROM gateway_merchants WHERE user_id = auth.uid())
    OR merchant_id IN (SELECT merchant_id FROM merchant_staff_roles WHERE user_id = auth.uid() AND is_active = true)
  )
  WITH CHECK (
    merchant_id IN (SELECT id FROM gateway_merchants WHERE user_id = auth.uid())
    OR merchant_id IN (SELECT merchant_id FROM merchant_staff_roles WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Anyone can view active coupons" ON pos_coupons
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- pos_store_reviews policies
CREATE POLICY "Customers can create reviews" ON pos_store_reviews
  FOR INSERT TO authenticated
  WITH CHECK (customer_user_id = auth.uid());

CREATE POLICY "Anyone can view reviews" ON pos_store_reviews
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Merchants can reply to reviews" ON pos_store_reviews
  FOR UPDATE TO authenticated
  USING (
    merchant_id IN (SELECT id FROM gateway_merchants WHERE user_id = auth.uid())
    OR merchant_id IN (SELECT merchant_id FROM merchant_staff_roles WHERE user_id = auth.uid() AND is_active = true)
  )
  WITH CHECK (
    merchant_id IN (SELECT id FROM gateway_merchants WHERE user_id = auth.uid())
    OR merchant_id IN (SELECT merchant_id FROM merchant_staff_roles WHERE user_id = auth.uid() AND is_active = true)
  );

-- business_app_feature_flags policies
CREATE POLICY "Admins can manage feature flags" ON business_app_feature_flags
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Merchants can view own flags" ON business_app_feature_flags
  FOR SELECT TO authenticated
  USING (
    merchant_id IN (SELECT id FROM gateway_merchants WHERE user_id = auth.uid())
    OR merchant_id IN (SELECT merchant_id FROM merchant_staff_roles WHERE user_id = auth.uid() AND is_active = true)
  );

-- merchant_notification_preferences policies
CREATE POLICY "Merchant can manage notification prefs" ON merchant_notification_preferences
  FOR ALL TO authenticated
  USING (
    merchant_id IN (SELECT id FROM gateway_merchants WHERE user_id = auth.uid())
    OR merchant_id IN (SELECT merchant_id FROM merchant_staff_roles WHERE user_id = auth.uid() AND is_active = true)
  )
  WITH CHECK (
    merchant_id IN (SELECT id FROM gateway_merchants WHERE user_id = auth.uid())
    OR merchant_id IN (SELECT merchant_id FROM merchant_staff_roles WHERE user_id = auth.uid() AND is_active = true)
  );

-- Admin full access
CREATE POLICY "Admins full access coupons" ON pos_coupons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins full access reviews" ON pos_store_reviews
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins full access notification prefs" ON merchant_notification_preferences
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Enable realtime on reviews
ALTER PUBLICATION supabase_realtime ADD TABLE pos_store_reviews;

-- Storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('pos-product-images', 'pos-product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view product images" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'pos-product-images');

CREATE POLICY "Authenticated users can upload product images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pos-product-images');

CREATE POLICY "Users can update own product images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'pos-product-images');

CREATE POLICY "Users can delete own product images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'pos-product-images');
