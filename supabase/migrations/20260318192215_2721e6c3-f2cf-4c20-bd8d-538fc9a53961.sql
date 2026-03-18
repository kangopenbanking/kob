
-- Bills v2 Domain: Provider Directory + Products + Payment Intents + Payments

-- 1. Bill Categories
CREATE TABLE public.bill_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'receipt',
  color TEXT NOT NULL DEFAULT 'hsl(210,60%,90%)',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Bill Providers (e.g. schools, utility companies)
CREATE TABLE public.bill_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.bill_categories(id),
  name TEXT NOT NULL,
  short_name TEXT,
  description TEXT,
  logo_url TEXT,
  icon TEXT DEFAULT 'building-2',
  country TEXT NOT NULL DEFAULT 'CM',
  is_active BOOLEAN NOT NULL DEFAULT true,
  settlement_type TEXT NOT NULL DEFAULT 'bank' CHECK (settlement_type IN ('bank','mobile_money','kang_wallet')),
  settlement_details JSONB DEFAULT '{}'::jsonb,
  contact_email TEXT,
  contact_phone TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bill_providers_category ON public.bill_providers(category_id);
CREATE INDEX idx_bill_providers_active ON public.bill_providers(is_active);

-- 3. Bill Provider Locations (campuses, branches)
CREATE TABLE public.bill_provider_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.bill_providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  region TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bill_provider_locations_provider ON public.bill_provider_locations(provider_id);

-- 4. Bill Products (e.g. Tuition, Exam Fees)
CREATE TABLE public.bill_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.bill_providers(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.bill_provider_locations(id),
  name TEXT NOT NULL,
  description TEXT,
  amount_type TEXT NOT NULL DEFAULT 'variable' CHECK (amount_type IN ('fixed','variable')),
  fixed_amount NUMERIC(15,2),
  min_amount NUMERIC(15,2) DEFAULT 100,
  max_amount NUMERIC(15,2) DEFAULT 10000000,
  currency TEXT NOT NULL DEFAULT 'XAF',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bill_products_provider ON public.bill_products(provider_id);
CREATE INDEX idx_bill_products_location ON public.bill_products(location_id);

-- 5. Bill Product Fields (dynamic payer input requirements)
CREATE TABLE public.bill_product_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.bill_products(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text' CHECK (field_type IN ('text','number','email','phone','select')),
  placeholder TEXT,
  is_required BOOLEAN NOT NULL DEFAULT true,
  validation_regex TEXT,
  options JSONB,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_bill_product_fields_product ON public.bill_product_fields(product_id);

-- 6. Bill Payment Intents
CREATE TABLE public.bill_payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider_id UUID NOT NULL REFERENCES public.bill_providers(id),
  location_id UUID REFERENCES public.bill_provider_locations(id),
  product_id UUID NOT NULL REFERENCES public.bill_products(id),
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  fee_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL,
  payer_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','paid','expired','cancelled')),
  idempotency_key TEXT UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bill_payment_intents_user ON public.bill_payment_intents(user_id);
CREATE INDEX idx_bill_payment_intents_status ON public.bill_payment_intents(status);

-- 7. Bill Payments (completed)
CREATE TABLE public.bill_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id UUID NOT NULL REFERENCES public.bill_payment_intents(id),
  user_id UUID NOT NULL,
  provider_id UUID NOT NULL REFERENCES public.bill_providers(id),
  location_id UUID REFERENCES public.bill_provider_locations(id),
  product_id UUID NOT NULL REFERENCES public.bill_products(id),
  amount NUMERIC(15,2) NOT NULL,
  fee_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  payer_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  receipt_number TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  transaction_id UUID,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','refunded','disputed')),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bill_payments_user ON public.bill_payments(user_id);
CREATE INDEX idx_bill_payments_provider ON public.bill_payments(provider_id);
CREATE INDEX idx_bill_payments_status ON public.bill_payments(status);
CREATE INDEX idx_bill_payments_created ON public.bill_payments(created_at);

-- 8. Bill Settlements
CREATE TABLE public.bill_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.bill_providers(id),
  payment_ids UUID[] NOT NULL DEFAULT '{}',
  total_amount NUMERIC(15,2) NOT NULL,
  fee_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  settlement_type TEXT NOT NULL,
  settlement_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bill_settlements_provider ON public.bill_settlements(provider_id);
CREATE INDEX idx_bill_settlements_status ON public.bill_settlements(status);

-- RLS
ALTER TABLE public.bill_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_provider_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_product_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_settlements ENABLE ROW LEVEL SECURITY;

-- Public read for directory tables
CREATE POLICY "Anyone can read active categories" ON public.bill_categories FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can read active providers" ON public.bill_providers FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can read active locations" ON public.bill_provider_locations FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can read active products" ON public.bill_products FOR SELECT USING (is_active = true);
CREATE POLICY "Anyone can read product fields" ON public.bill_product_fields FOR SELECT USING (true);

-- User-scoped for payment data
CREATE POLICY "Users can read own intents" ON public.bill_payment_intents FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own intents" ON public.bill_payment_intents FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own intents" ON public.bill_payment_intents FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can read own payments" ON public.bill_payments FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Service role manages payments" ON public.bill_payments FOR ALL USING (true);

CREATE POLICY "Admin manages settlements" ON public.bill_settlements FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Admin manage directory
CREATE POLICY "Admin manages categories" ON public.bill_categories FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin manages providers" ON public.bill_providers FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin manages locations" ON public.bill_provider_locations FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin manages products" ON public.bill_products FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin manages fields" ON public.bill_product_fields FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Seed initial categories
INSERT INTO public.bill_categories (name, slug, icon, color, sort_order) VALUES
  ('School Fees', 'school-fees', 'graduation-cap', 'hsl(210,70%,90%)', 1),
  ('Electricity', 'electricity', 'zap', 'hsl(45,90%,88%)', 2),
  ('Water', 'water', 'droplets', 'hsl(200,80%,90%)', 3),
  ('Internet', 'internet', 'wifi', 'hsl(160,60%,88%)', 4),
  ('TV & Cable', 'tv-cable', 'tv', 'hsl(280,60%,90%)', 5),
  ('Phone', 'phone', 'phone', 'hsl(340,70%,90%)', 6),
  ('Insurance', 'insurance', 'shield', 'hsl(25,80%,90%)', 7),
  ('Government', 'government', 'landmark', 'hsl(0,0%,90%)', 8);

-- Seed sample school providers
INSERT INTO public.bill_providers (category_id, name, short_name, icon, settlement_type) VALUES
  ((SELECT id FROM public.bill_categories WHERE slug='school-fees'), 'Université de Yaoundé I', 'UY1', 'graduation-cap', 'bank'),
  ((SELECT id FROM public.bill_categories WHERE slug='school-fees'), 'Université de Douala', 'UD', 'graduation-cap', 'bank'),
  ((SELECT id FROM public.bill_categories WHERE slug='school-fees'), 'Catholic University of Central Africa (UCAC)', 'UCAC', 'graduation-cap', 'bank'),
  ((SELECT id FROM public.bill_categories WHERE slug='electricity'), 'ENEO Cameroon', 'ENEO', 'zap', 'mobile_money'),
  ((SELECT id FROM public.bill_categories WHERE slug='water'), 'CamWater', 'CamWater', 'droplets', 'mobile_money'),
  ((SELECT id FROM public.bill_categories WHERE slug='internet'), 'Camtel', 'Camtel', 'wifi', 'bank'),
  ((SELECT id FROM public.bill_categories WHERE slug='tv-cable'), 'Canal+', 'Canal+', 'tv', 'bank'),
  ((SELECT id FROM public.bill_categories WHERE slug='phone'), 'MTN Cameroon', 'MTN', 'phone', 'mobile_money');

-- Seed locations for universities
INSERT INTO public.bill_provider_locations (provider_id, name, city, region) VALUES
  ((SELECT id FROM public.bill_providers WHERE short_name='UY1'), 'Campus Principal - Ngoa Ekelle', 'Yaoundé', 'Centre'),
  ((SELECT id FROM public.bill_providers WHERE short_name='UY1'), 'École Normale Supérieure', 'Yaoundé', 'Centre'),
  ((SELECT id FROM public.bill_providers WHERE short_name='UY1'), 'Faculté de Médecine', 'Yaoundé', 'Centre'),
  ((SELECT id FROM public.bill_providers WHERE short_name='UD'), 'Campus Principal', 'Douala', 'Littoral'),
  ((SELECT id FROM public.bill_providers WHERE short_name='UD'), 'ENSET', 'Douala', 'Littoral'),
  ((SELECT id FROM public.bill_providers WHERE short_name='UCAC'), 'Campus de Nkolbisson', 'Yaoundé', 'Centre');

-- Seed products for UY1
INSERT INTO public.bill_products (provider_id, name, description, amount_type, fixed_amount, min_amount, max_amount) VALUES
  ((SELECT id FROM public.bill_providers WHERE short_name='UY1'), 'Tuition Fees', 'Annual tuition fees', 'fixed', 50000, NULL, NULL),
  ((SELECT id FROM public.bill_providers WHERE short_name='UY1'), 'Registration Fees', 'Semester registration', 'fixed', 25000, NULL, NULL),
  ((SELECT id FROM public.bill_providers WHERE short_name='UY1'), 'Exam Fees', 'Examination fees', 'fixed', 15000, NULL, NULL),
  ((SELECT id FROM public.bill_providers WHERE short_name='UY1'), 'Library Fees', 'Annual library access', 'fixed', 5000, NULL, NULL),
  ((SELECT id FROM public.bill_providers WHERE short_name='ENEO'), 'Electricity Bill', 'Pay your electricity bill', 'variable', NULL, 500, 5000000),
  ((SELECT id FROM public.bill_providers WHERE short_name='CamWater'), 'Water Bill', 'Pay your water bill', 'variable', NULL, 500, 2000000),
  ((SELECT id FROM public.bill_providers WHERE short_name='Camtel'), 'Internet Subscription', 'Monthly internet bill', 'variable', NULL, 1000, 500000),
  ((SELECT id FROM public.bill_providers WHERE short_name='Canal+'), 'TV Subscription', 'Monthly TV subscription', 'variable', NULL, 3000, 100000),
  ((SELECT id FROM public.bill_providers WHERE short_name='MTN'), 'Airtime Top-up', 'Mobile phone credit', 'variable', NULL, 100, 100000);

-- Seed product fields for school tuition
INSERT INTO public.bill_product_fields (product_id, field_key, label, field_type, placeholder, is_required, sort_order) VALUES
  ((SELECT id FROM public.bill_products WHERE name='Tuition Fees' LIMIT 1), 'student_name', 'Student Full Name', 'text', 'Enter student name', true, 1),
  ((SELECT id FROM public.bill_products WHERE name='Tuition Fees' LIMIT 1), 'student_id', 'Student ID / Matricule', 'text', 'e.g. 20CM1234', true, 2),
  ((SELECT id FROM public.bill_products WHERE name='Tuition Fees' LIMIT 1), 'payer_name', 'Payer Full Name', 'text', 'Name of person paying', true, 3),
  ((SELECT id FROM public.bill_products WHERE name='Tuition Fees' LIMIT 1), 'payer_phone', 'Payer Phone', 'phone', '+237 6XX XXX XXX', true, 4),
  ((SELECT id FROM public.bill_products WHERE name='Tuition Fees' LIMIT 1), 'academic_year', 'Academic Year', 'text', 'e.g. 2025-2026', false, 5);

-- Fields for electricity
INSERT INTO public.bill_product_fields (product_id, field_key, label, field_type, placeholder, is_required, sort_order) VALUES
  ((SELECT id FROM public.bill_products WHERE name='Electricity Bill' LIMIT 1), 'meter_number', 'Meter Number', 'text', 'Enter your meter number', true, 1),
  ((SELECT id FROM public.bill_products WHERE name='Electricity Bill' LIMIT 1), 'customer_name', 'Customer Name', 'text', 'Name on account', true, 2);

-- Fields for water
INSERT INTO public.bill_product_fields (product_id, field_key, label, field_type, placeholder, is_required, sort_order) VALUES
  ((SELECT id FROM public.bill_products WHERE name='Water Bill' LIMIT 1), 'account_number', 'Account Number', 'text', 'Enter your account number', true, 1),
  ((SELECT id FROM public.bill_products WHERE name='Water Bill' LIMIT 1), 'customer_name', 'Customer Name', 'text', 'Name on account', true, 2);

-- Fields for internet/TV/phone
INSERT INTO public.bill_product_fields (product_id, field_key, label, field_type, placeholder, is_required, sort_order) VALUES
  ((SELECT id FROM public.bill_products WHERE name='Internet Subscription' LIMIT 1), 'account_number', 'Account Number', 'text', 'Enter account number', true, 1),
  ((SELECT id FROM public.bill_products WHERE name='TV Subscription' LIMIT 1), 'decoder_number', 'Decoder Number', 'text', 'Enter decoder number', true, 1),
  ((SELECT id FROM public.bill_products WHERE name='Airtime Top-up' LIMIT 1), 'phone_number', 'Phone Number', 'phone', '+237 6XX XXX XXX', true, 1);
