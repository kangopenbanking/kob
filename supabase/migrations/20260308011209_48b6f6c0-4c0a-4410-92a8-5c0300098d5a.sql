
-- ============================================================
-- PHASE 1: POS COMMERCE DATA MODEL
-- All tables are ADDITIVE — zero changes to existing tables
-- ============================================================

-- ─── ENUMS ───────────────────────────────────────────────────
CREATE TYPE public.pos_product_source AS ENUM ('manual', 'woocommerce');
CREATE TYPE public.pos_order_channel AS ENUM ('pos', 'woocommerce', 'api');
CREATE TYPE public.pos_order_status AS ENUM (
  'draft', 'pending_payment', 'paid', 'processing',
  'completed', 'cancelled', 'refunded', 'partially_refunded', 'failed'
);
CREATE TYPE public.pos_payment_status AS ENUM (
  'initiated', 'pending', 'succeeded', 'failed',
  'cancelled', 'refunded', 'partial_refund'
);
CREATE TYPE public.pos_return_status AS ENUM ('requested', 'approved', 'rejected', 'processed');
CREATE TYPE public.inventory_movement_type AS ENUM (
  'sale', 'refund', 'manual_adjust', 'sync_adjust', 'transfer_in', 'transfer_out'
);
CREATE TYPE public.integration_type AS ENUM ('woocommerce');
CREATE TYPE public.integration_status AS ENUM ('connected', 'disconnected', 'error');
CREATE TYPE public.integration_entity_type AS ENUM ('product', 'variant', 'order', 'customer');
CREATE TYPE public.sync_run_status AS ENUM ('running', 'success', 'failed');
CREATE TYPE public.inbox_event_status AS ENUM ('received', 'processed', 'ignored', 'failed');
CREATE TYPE public.pos_staff_role AS ENUM ('merchant_admin', 'merchant_manager', 'cashier');

-- ─── 1. MERCHANT LOCATIONS ──────────────────────────────────
CREATE TABLE public.merchant_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address_json JSONB DEFAULT '{}'::jsonb,
  city TEXT DEFAULT 'Douala',
  country TEXT NOT NULL DEFAULT 'CM',
  timezone TEXT DEFAULT 'Africa/Douala',
  currency_default TEXT NOT NULL DEFAULT 'XAF',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 2. MERCHANT POS STAFF ──────────────────────────────────
CREATE TABLE public.merchant_pos_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.pos_staff_role NOT NULL DEFAULT 'cashier',
  pin_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, user_id)
);

-- ─── 3. PRODUCTS ─────────────────────────────────────────────
CREATE TABLE public.pos_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  currency TEXT NOT NULL DEFAULT 'XAF',
  tax_class TEXT,
  source public.pos_product_source NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 4. PRODUCT VARIANTS ────────────────────────────────────
CREATE TABLE public.pos_product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.pos_products(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  sku TEXT,
  barcode TEXT,
  name TEXT NOT NULL DEFAULT 'Default',
  attributes_json JSONB DEFAULT '{}'::jsonb,
  price NUMERIC(15,2) NOT NULL DEFAULT 0,
  compare_at_price NUMERIC(15,2),
  cost_price NUMERIC(15,2),
  track_inventory BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, sku)
);

-- ─── 5. CATEGORIES ──────────────────────────────────────────
CREATE TABLE public.pos_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.pos_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 6. PRODUCT ↔ CATEGORY LINKS ────────────────────────────
CREATE TABLE public.pos_product_category_links (
  product_id UUID NOT NULL REFERENCES public.pos_products(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.pos_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

-- ─── 7. PRODUCT IMAGES ──────────────────────────────────────
CREATE TABLE public.pos_product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.pos_products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 8. INVENTORY ITEMS ─────────────────────────────────────
CREATE TABLE public.pos_inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.pos_product_variants(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.merchant_locations(id) ON DELETE CASCADE,
  quantity_on_hand INT NOT NULL DEFAULT 0,
  reorder_level INT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (variant_id, location_id)
);

-- ─── 9. INVENTORY MOVEMENTS (IMMUTABLE) ─────────────────────
CREATE TABLE public.pos_inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES public.pos_product_variants(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.merchant_locations(id) ON DELETE CASCADE,
  type public.inventory_movement_type NOT NULL,
  quantity_delta INT NOT NULL,
  reason TEXT,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 10. ORDERS ──────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS pos_order_number_seq;

CREATE TABLE public.pos_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.merchant_locations(id),
  channel public.pos_order_channel NOT NULL DEFAULT 'pos',
  external_reference TEXT,
  order_number TEXT NOT NULL DEFAULT ('POS-' || lpad(nextval('pos_order_number_seq')::text, 6, '0')),
  status public.pos_order_status NOT NULL DEFAULT 'draft',
  currency TEXT NOT NULL DEFAULT 'XAF',
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  total NUMERIC(15,2) NOT NULL DEFAULT 0,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  metadata_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 11. ORDER ITEMS ─────────────────────────────────────────
CREATE TABLE public.pos_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.pos_orders(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.pos_products(id),
  variant_id UUID REFERENCES public.pos_product_variants(id),
  name_snapshot TEXT NOT NULL,
  sku_snapshot TEXT,
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 12. ORDER STATUS HISTORY (IMMUTABLE) ────────────────────
CREATE TABLE public.pos_order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.pos_orders(id) ON DELETE CASCADE,
  status public.pos_order_status NOT NULL,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 13. ORDER PAYMENTS ──────────────────────────────────────
CREATE TABLE public.pos_order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.pos_orders(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  charge_id UUID REFERENCES public.gateway_charges(id),
  status public.pos_payment_status NOT NULL DEFAULT 'initiated',
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'XAF',
  provider TEXT,
  method TEXT,
  provider_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 14. RETURNS ─────────────────────────────────────────────
CREATE TABLE public.pos_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.pos_orders(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  status public.pos_return_status NOT NULL DEFAULT 'requested',
  reason TEXT,
  refund_id UUID REFERENCES public.gateway_refunds(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 15. RETURN ITEMS ────────────────────────────────────────
CREATE TABLE public.pos_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.pos_returns(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES public.pos_order_items(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  restock BOOLEAN NOT NULL DEFAULT true
);

-- ─── 16. MERCHANT INTEGRATIONS ──────────────────────────────
CREATE TABLE public.merchant_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  type public.integration_type NOT NULL DEFAULT 'woocommerce',
  status public.integration_status NOT NULL DEFAULT 'disconnected',
  base_url TEXT,
  credentials_json JSONB DEFAULT '{}'::jsonb,
  webhook_secret TEXT,
  settings_json JSONB DEFAULT '{"sync_strategy": "woo_source_of_truth"}'::jsonb,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, type)
);

-- ─── 17. INTEGRATION MAPPINGS ────────────────────────────────
CREATE TABLE public.integration_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.merchant_integrations(id) ON DELETE CASCADE,
  entity_type public.integration_entity_type NOT NULL,
  kob_id UUID NOT NULL,
  external_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (integration_id, entity_type, external_id)
);

-- ─── 18. INTEGRATION SYNC RUNS ──────────────────────────────
CREATE TABLE public.integration_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.merchant_integrations(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'full',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status public.sync_run_status NOT NULL DEFAULT 'running',
  summary_json JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 19. INTEGRATION EVENTS INBOX (DEDUPED) ─────────────────
CREATE TABLE public.integration_events_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.merchant_integrations(id) ON DELETE CASCADE,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  status public.inbox_event_status NOT NULL DEFAULT 'received',
  error_message TEXT,
  UNIQUE (integration_id, provider_event_id)
);

-- ─── INDEXES ─────────────────────────────────────────────────
CREATE INDEX idx_merchant_locations_merchant ON merchant_locations(merchant_id);
CREATE INDEX idx_pos_products_merchant ON pos_products(merchant_id);
CREATE INDEX idx_pos_products_source ON pos_products(source);
CREATE INDEX idx_pos_variants_product ON pos_product_variants(product_id);
CREATE INDEX idx_pos_variants_sku ON pos_product_variants(merchant_id, sku);
CREATE INDEX idx_pos_inventory_variant_location ON pos_inventory_items(variant_id, location_id);
CREATE INDEX idx_pos_inventory_merchant ON pos_inventory_items(merchant_id);
CREATE INDEX idx_pos_movements_variant ON pos_inventory_movements(variant_id);
CREATE INDEX idx_pos_movements_created ON pos_inventory_movements(created_at);
CREATE INDEX idx_pos_orders_merchant ON pos_orders(merchant_id);
CREATE INDEX idx_pos_orders_status ON pos_orders(status);
CREATE INDEX idx_pos_orders_channel ON pos_orders(channel);
CREATE INDEX idx_pos_orders_number ON pos_orders(merchant_id, order_number);
CREATE INDEX idx_pos_orders_created ON pos_orders(created_at);
CREATE INDEX idx_pos_order_items_order ON pos_order_items(order_id);
CREATE INDEX idx_pos_order_payments_order ON pos_order_payments(order_id);
CREATE INDEX idx_pos_order_payments_charge ON pos_order_payments(charge_id);
CREATE INDEX idx_pos_returns_order ON pos_returns(order_id);
CREATE INDEX idx_merchant_integrations_merchant ON merchant_integrations(merchant_id);
CREATE INDEX idx_integration_mappings_kob ON integration_mappings(kob_id);
CREATE INDEX idx_integration_mappings_external ON integration_mappings(integration_id, entity_type, external_id);
CREATE INDEX idx_integration_events_status ON integration_events_inbox(status);

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.merchant_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_pos_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_product_category_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_order_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_events_inbox ENABLE ROW LEVEL SECURITY;

-- ─── RLS POLICIES: Merchant owner access ─────────────────────
-- Helper: check if user owns the merchant
CREATE OR REPLACE FUNCTION public.is_merchant_owner(_user_id uuid, _merchant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.gateway_merchants
    WHERE id = _merchant_id AND user_id = _user_id
  )
$$;

-- Helper: check if user is POS staff for merchant
CREATE OR REPLACE FUNCTION public.is_pos_staff(_user_id uuid, _merchant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchant_pos_staff
    WHERE merchant_id = _merchant_id AND user_id = _user_id AND status = 'active'
  )
$$;

-- Macro for merchant-scoped RLS: owner OR staff OR admin
-- Apply to each table:

-- merchant_locations
CREATE POLICY "Merchant owner/staff/admin can manage locations" ON public.merchant_locations
  FOR ALL TO authenticated
  USING (
    public.is_merchant_owner(auth.uid(), merchant_id)
    OR public.is_pos_staff(auth.uid(), merchant_id)
    OR public.has_role(auth.uid(), 'admin')
  );

-- merchant_pos_staff
CREATE POLICY "Merchant owner/admin can manage staff" ON public.merchant_pos_staff
  FOR ALL TO authenticated
  USING (
    public.is_merchant_owner(auth.uid(), merchant_id)
    OR public.has_role(auth.uid(), 'admin')
  );

-- pos_products
CREATE POLICY "Merchant owner/staff/admin can manage products" ON public.pos_products
  FOR ALL TO authenticated
  USING (
    public.is_merchant_owner(auth.uid(), merchant_id)
    OR public.is_pos_staff(auth.uid(), merchant_id)
    OR public.has_role(auth.uid(), 'admin')
  );

-- pos_product_variants
CREATE POLICY "Merchant owner/staff/admin can manage variants" ON public.pos_product_variants
  FOR ALL TO authenticated
  USING (
    public.is_merchant_owner(auth.uid(), merchant_id)
    OR public.is_pos_staff(auth.uid(), merchant_id)
    OR public.has_role(auth.uid(), 'admin')
  );

-- pos_categories
CREATE POLICY "Merchant owner/staff/admin can manage categories" ON public.pos_categories
  FOR ALL TO authenticated
  USING (
    public.is_merchant_owner(auth.uid(), merchant_id)
    OR public.is_pos_staff(auth.uid(), merchant_id)
    OR public.has_role(auth.uid(), 'admin')
  );

-- pos_product_category_links
CREATE POLICY "Merchant can manage product-category links" ON public.pos_product_category_links
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pos_products p
      WHERE p.id = product_id
      AND (public.is_merchant_owner(auth.uid(), p.merchant_id) OR public.is_pos_staff(auth.uid(), p.merchant_id) OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- pos_product_images
CREATE POLICY "Merchant can manage product images" ON public.pos_product_images
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pos_products p
      WHERE p.id = product_id
      AND (public.is_merchant_owner(auth.uid(), p.merchant_id) OR public.is_pos_staff(auth.uid(), p.merchant_id) OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- pos_inventory_items
CREATE POLICY "Merchant owner/staff/admin can manage inventory" ON public.pos_inventory_items
  FOR ALL TO authenticated
  USING (
    public.is_merchant_owner(auth.uid(), merchant_id)
    OR public.is_pos_staff(auth.uid(), merchant_id)
    OR public.has_role(auth.uid(), 'admin')
  );

-- pos_inventory_movements
CREATE POLICY "Merchant can view/create movements" ON public.pos_inventory_movements
  FOR ALL TO authenticated
  USING (
    public.is_merchant_owner(auth.uid(), merchant_id)
    OR public.is_pos_staff(auth.uid(), merchant_id)
    OR public.has_role(auth.uid(), 'admin')
  );

-- pos_orders
CREATE POLICY "Merchant owner/staff/admin can manage orders" ON public.pos_orders
  FOR ALL TO authenticated
  USING (
    public.is_merchant_owner(auth.uid(), merchant_id)
    OR public.is_pos_staff(auth.uid(), merchant_id)
    OR public.has_role(auth.uid(), 'admin')
  );

-- pos_order_items
CREATE POLICY "Merchant can manage order items" ON public.pos_order_items
  FOR ALL TO authenticated
  USING (
    public.is_merchant_owner(auth.uid(), merchant_id)
    OR public.is_pos_staff(auth.uid(), merchant_id)
    OR public.has_role(auth.uid(), 'admin')
  );

-- pos_order_status_history
CREATE POLICY "Merchant can view/create status history" ON public.pos_order_status_history
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pos_orders o
      WHERE o.id = order_id
      AND (public.is_merchant_owner(auth.uid(), o.merchant_id) OR public.is_pos_staff(auth.uid(), o.merchant_id) OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- pos_order_payments
CREATE POLICY "Merchant can manage order payments" ON public.pos_order_payments
  FOR ALL TO authenticated
  USING (
    public.is_merchant_owner(auth.uid(), merchant_id)
    OR public.is_pos_staff(auth.uid(), merchant_id)
    OR public.has_role(auth.uid(), 'admin')
  );

-- pos_returns
CREATE POLICY "Merchant can manage returns" ON public.pos_returns
  FOR ALL TO authenticated
  USING (
    public.is_merchant_owner(auth.uid(), merchant_id)
    OR public.is_pos_staff(auth.uid(), merchant_id)
    OR public.has_role(auth.uid(), 'admin')
  );

-- pos_return_items
CREATE POLICY "Merchant can manage return items" ON public.pos_return_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pos_returns r
      WHERE r.id = return_id
      AND (public.is_merchant_owner(auth.uid(), r.merchant_id) OR public.is_pos_staff(auth.uid(), r.merchant_id) OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- merchant_integrations
CREATE POLICY "Merchant owner/admin can manage integrations" ON public.merchant_integrations
  FOR ALL TO authenticated
  USING (
    public.is_merchant_owner(auth.uid(), merchant_id)
    OR public.has_role(auth.uid(), 'admin')
  );

-- integration_mappings
CREATE POLICY "Merchant owner/admin can manage mappings" ON public.integration_mappings
  FOR ALL TO authenticated
  USING (
    public.is_merchant_owner(auth.uid(), merchant_id)
    OR public.has_role(auth.uid(), 'admin')
  );

-- integration_sync_runs
CREATE POLICY "Merchant owner/admin can manage sync runs" ON public.integration_sync_runs
  FOR ALL TO authenticated
  USING (
    public.is_merchant_owner(auth.uid(), merchant_id)
    OR public.has_role(auth.uid(), 'admin')
  );

-- integration_events_inbox
CREATE POLICY "Merchant owner/admin can view events" ON public.integration_events_inbox
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.merchant_integrations mi
      WHERE mi.id = integration_id
      AND (public.is_merchant_owner(auth.uid(), mi.merchant_id) OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- ─── TRIGGER: auto-update updated_at ─────────────────────────
CREATE OR REPLACE FUNCTION public.update_pos_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_merchant_locations_updated BEFORE UPDATE ON merchant_locations FOR EACH ROW EXECUTE FUNCTION update_pos_updated_at();
CREATE TRIGGER trg_merchant_pos_staff_updated BEFORE UPDATE ON merchant_pos_staff FOR EACH ROW EXECUTE FUNCTION update_pos_updated_at();
CREATE TRIGGER trg_pos_products_updated BEFORE UPDATE ON pos_products FOR EACH ROW EXECUTE FUNCTION update_pos_updated_at();
CREATE TRIGGER trg_pos_variants_updated BEFORE UPDATE ON pos_product_variants FOR EACH ROW EXECUTE FUNCTION update_pos_updated_at();
CREATE TRIGGER trg_pos_inventory_updated BEFORE UPDATE ON pos_inventory_items FOR EACH ROW EXECUTE FUNCTION update_pos_updated_at();
CREATE TRIGGER trg_pos_orders_updated BEFORE UPDATE ON pos_orders FOR EACH ROW EXECUTE FUNCTION update_pos_updated_at();
CREATE TRIGGER trg_pos_order_payments_updated BEFORE UPDATE ON pos_order_payments FOR EACH ROW EXECUTE FUNCTION update_pos_updated_at();
CREATE TRIGGER trg_pos_returns_updated BEFORE UPDATE ON pos_returns FOR EACH ROW EXECUTE FUNCTION update_pos_updated_at();
CREATE TRIGGER trg_merchant_integrations_updated BEFORE UPDATE ON merchant_integrations FOR EACH ROW EXECUTE FUNCTION update_pos_updated_at();

-- ─── ATOMIC: Inventory adjustment function ───────────────────
CREATE OR REPLACE FUNCTION public.pos_adjust_inventory(
  _merchant_id UUID,
  _variant_id UUID,
  _location_id UUID,
  _quantity_delta INT,
  _type inventory_movement_type,
  _reason TEXT DEFAULT NULL,
  _reference_type TEXT DEFAULT NULL,
  _reference_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_new_qty INT;
BEGIN
  -- Upsert inventory item
  INSERT INTO pos_inventory_items (merchant_id, variant_id, location_id, quantity_on_hand)
  VALUES (_merchant_id, _variant_id, _location_id, GREATEST(_quantity_delta, 0))
  ON CONFLICT (variant_id, location_id)
  DO UPDATE SET
    quantity_on_hand = pos_inventory_items.quantity_on_hand + _quantity_delta,
    updated_at = now();

  -- Get new quantity
  SELECT quantity_on_hand INTO v_new_qty
  FROM pos_inventory_items
  WHERE variant_id = _variant_id AND location_id = _location_id;

  -- Record movement
  INSERT INTO pos_inventory_movements (merchant_id, variant_id, location_id, type, quantity_delta, reason, reference_type, reference_id)
  VALUES (_merchant_id, _variant_id, _location_id, _type, _quantity_delta, _reason, _reference_type, _reference_id);

  RETURN jsonb_build_object(
    'variant_id', _variant_id,
    'location_id', _location_id,
    'quantity_delta', _quantity_delta,
    'new_quantity', v_new_qty
  );
END;
$$;
