
-- 1. Add 'consumer_app' to pos_order_channel enum
ALTER TYPE public.pos_order_channel ADD VALUE IF NOT EXISTS 'consumer_app';

-- 2. Subscription plans (admin-managed)
CREATE TABLE public.pos_subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'XAF',
  duration_days INTEGER NOT NULL DEFAULT 30,
  features_json JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Store subscriptions
CREATE TABLE public.pos_store_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.pos_subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Store profiles (public-facing)
CREATE TABLE public.pos_store_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL UNIQUE REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  category TEXT,
  city TEXT DEFAULT 'Douala',
  country TEXT NOT NULL DEFAULT 'CM',
  is_published BOOLEAN NOT NULL DEFAULT false,
  rating NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Consumer carts
CREATE TABLE public.pos_consumer_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','checked_out','abandoned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Consumer cart items
CREATE TABLE public.pos_consumer_cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES public.pos_consumer_carts(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.pos_product_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: pos_subscription_plans (public read, admin write)
ALTER TABLE public.pos_subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active plans" ON public.pos_subscription_plans FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Admins can manage plans" ON public.pos_subscription_plans FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS: pos_store_subscriptions
ALTER TABLE public.pos_store_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchant owners can view own subscriptions" ON public.pos_store_subscriptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.gateway_merchants gm WHERE gm.id = merchant_id AND gm.user_id = auth.uid()));
CREATE POLICY "Merchant owners can insert subscriptions" ON public.pos_store_subscriptions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.gateway_merchants gm WHERE gm.id = merchant_id AND gm.user_id = auth.uid()));
CREATE POLICY "Admins can manage subscriptions" ON public.pos_store_subscriptions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS: pos_store_profiles
ALTER TABLE public.pos_store_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published stores visible to all authenticated" ON public.pos_store_profiles FOR SELECT TO authenticated USING (is_published = true);
CREATE POLICY "Merchant owners can manage own profile" ON public.pos_store_profiles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.gateway_merchants gm WHERE gm.id = merchant_id AND gm.user_id = auth.uid()));
CREATE POLICY "Admins can manage all profiles" ON public.pos_store_profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS: pos_consumer_carts
ALTER TABLE public.pos_consumer_carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own carts" ON public.pos_consumer_carts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- RLS: pos_consumer_cart_items
ALTER TABLE public.pos_consumer_cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own cart items" ON public.pos_consumer_cart_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pos_consumer_carts c WHERE c.id = cart_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pos_consumer_carts c WHERE c.id = cart_id AND c.user_id = auth.uid()));

-- Add SELECT policies for products/variants for published stores (consumer browsing)
CREATE POLICY "Consumers can view products of published stores" ON public.pos_products FOR SELECT TO authenticated
  USING (status = 'active' AND EXISTS (SELECT 1 FROM public.pos_store_profiles sp WHERE sp.merchant_id = merchant_id AND sp.is_published = true));

CREATE POLICY "Consumers can view variants of published stores" ON public.pos_product_variants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pos_products p JOIN public.pos_store_profiles sp ON sp.merchant_id = p.merchant_id WHERE p.id = product_id AND p.status = 'active' AND sp.is_published = true));
