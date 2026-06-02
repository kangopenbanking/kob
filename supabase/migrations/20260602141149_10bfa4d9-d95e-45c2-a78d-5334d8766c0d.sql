
CREATE TABLE IF NOT EXISTS public.ddn_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  mode TEXT NOT NULL DEFAULT 'platform' CHECK (mode IN ('platform','merchant')),
  owner_merchant_id UUID NULL,
  full_name TEXT NOT NULL,
  photo_url TEXT,
  phone TEXT NOT NULL,
  address TEXT,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('bike','scooter','motorbike','car','foot')),
  vehicle_registration TEXT,
  coverage_center_lat NUMERIC(9,6),
  coverage_center_lng NUMERIC(9,6),
  coverage_radius_km NUMERIC(6,2) DEFAULT 10,
  kyc_status TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending','approved','rejected')),
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','suspended','rejected')),
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('offline','online','busy','delivering','paused')),
  rating NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  total_deliveries INTEGER NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ddn_drivers_status ON public.ddn_drivers(status) WHERE approval_status='approved';
CREATE INDEX IF NOT EXISTS idx_ddn_drivers_owner ON public.ddn_drivers(owner_merchant_id);
GRANT SELECT, INSERT, UPDATE ON public.ddn_drivers TO authenticated;
GRANT ALL ON public.ddn_drivers TO service_role;
ALTER TABLE public.ddn_drivers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ddn_driver_locations (
  driver_id UUID PRIMARY KEY REFERENCES public.ddn_drivers(id) ON DELETE CASCADE,
  lat NUMERIC(9,6) NOT NULL,
  lng NUMERIC(9,6) NOT NULL,
  heading NUMERIC(5,2),
  speed_kmh NUMERIC(5,2),
  accuracy_m NUMERIC(7,2),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ddn_driver_locations TO authenticated;
GRANT ALL ON public.ddn_driver_locations TO service_role;
ALTER TABLE public.ddn_driver_locations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ddn_driver_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.ddn_drivers(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ddn_driver_status_log TO authenticated;
GRANT ALL ON public.ddn_driver_status_log TO service_role;
ALTER TABLE public.ddn_driver_status_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ddn_merchant_delivery_settings (
  merchant_id UUID PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'hybrid' CHECK (mode IN ('merchant','platform','hybrid')),
  delivery_radius_km NUMERIC(5,2) NOT NULL DEFAULT 8,
  base_fee_xaf INTEGER NOT NULL DEFAULT 500,
  per_km_fee_xaf INTEGER NOT NULL DEFAULT 100,
  prep_time_min INTEGER NOT NULL DEFAULT 20,
  auto_assign BOOLEAN NOT NULL DEFAULT TRUE,
  platform_fee_pct NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ddn_merchant_delivery_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.ddn_merchant_delivery_settings TO authenticated;
GRANT ALL ON public.ddn_merchant_delivery_settings TO service_role;
ALTER TABLE public.ddn_merchant_delivery_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ddn_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.daily_needs_orders(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL,
  driver_id UUID REFERENCES public.ddn_drivers(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','offered','accepted','picked_up','on_the_way','arriving','delivered','assignment_failed','cancelled')),
  pickup_lat NUMERIC(9,6),
  pickup_lng NUMERIC(9,6),
  drop_lat NUMERIC(9,6),
  drop_lng NUMERIC(9,6),
  distance_km NUMERIC(6,2),
  eta_min INTEGER,
  delivery_fee_xaf INTEGER NOT NULL DEFAULT 0,
  platform_fee_xaf INTEGER NOT NULL DEFAULT 0,
  driver_earnings_xaf INTEGER NOT NULL DEFAULT 0,
  assigned_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ddn_assignments_driver_status ON public.ddn_assignments(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_ddn_assignments_merchant ON public.ddn_assignments(merchant_id, status);
GRANT SELECT, INSERT, UPDATE ON public.ddn_assignments TO authenticated;
GRANT ALL ON public.ddn_assignments TO service_role;
ALTER TABLE public.ddn_assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ddn_assignment_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.ddn_assignments(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.ddn_drivers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offered' CHECK (status IN ('offered','accepted','declined','timed_out','superseded')),
  expires_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ddn_offers_driver ON public.ddn_assignment_offers(driver_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ddn_offers_active ON public.ddn_assignment_offers(assignment_id, driver_id) WHERE status='offered';
GRANT SELECT, UPDATE ON public.ddn_assignment_offers TO authenticated;
GRANT ALL ON public.ddn_assignment_offers TO service_role;
ALTER TABLE public.ddn_assignment_offers ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ddn_delivery_proofs (
  assignment_id UUID PRIMARY KEY REFERENCES public.ddn_assignments(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  code_verified_at TIMESTAMPTZ,
  photo_url TEXT,
  drop_lat NUMERIC(9,6),
  drop_lng NUMERIC(9,6),
  customer_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ddn_delivery_proofs TO authenticated;
GRANT ALL ON public.ddn_delivery_proofs TO service_role;
ALTER TABLE public.ddn_delivery_proofs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ddn_driver_wallets (
  driver_id UUID PRIMARY KEY REFERENCES public.ddn_drivers(id) ON DELETE CASCADE,
  available_xaf BIGINT NOT NULL DEFAULT 0,
  pending_xaf BIGINT NOT NULL DEFAULT 0,
  lifetime_earned_xaf BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ddn_driver_wallets TO authenticated;
GRANT ALL ON public.ddn_driver_wallets TO service_role;
ALTER TABLE public.ddn_driver_wallets ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ddn_driver_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.ddn_drivers(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL UNIQUE REFERENCES public.ddn_assignments(id) ON DELETE CASCADE,
  gross_fee_xaf INTEGER NOT NULL,
  platform_fee_xaf INTEGER NOT NULL,
  driver_earnings_xaf INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','available','paid_out')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ddn_earnings_driver ON public.ddn_driver_earnings(driver_id, created_at DESC);
GRANT SELECT ON public.ddn_driver_earnings TO authenticated;
GRANT ALL ON public.ddn_driver_earnings TO service_role;
ALTER TABLE public.ddn_driver_earnings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "ddn_drivers self read" ON public.ddn_drivers FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ddn_drivers self update" ON public.ddn_drivers FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ddn_drivers self insert" ON public.ddn_drivers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "ddn_drivers merchant read" ON public.ddn_drivers FOR SELECT TO authenticated
  USING (owner_merchant_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.gateway_merchants m WHERE m.id = ddn_drivers.owner_merchant_id AND m.user_id = auth.uid()
  ));
CREATE POLICY "ddn_drivers admin read" ON public.ddn_drivers FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "ddn_loc driver write" ON public.ddn_driver_locations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ddn_drivers d WHERE d.id = ddn_driver_locations.driver_id AND d.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ddn_drivers d WHERE d.id = ddn_driver_locations.driver_id AND d.user_id = auth.uid()));
CREATE POLICY "ddn_loc customer read" ON public.ddn_driver_locations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ddn_assignments a
    JOIN public.daily_needs_orders o ON o.id = a.order_id
    WHERE a.driver_id = ddn_driver_locations.driver_id
      AND a.status IN ('accepted','picked_up','on_the_way','arriving')
      AND o.user_id = auth.uid()
  ));

CREATE POLICY "ddn_status driver read" ON public.ddn_driver_status_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ddn_drivers d WHERE d.id = ddn_driver_status_log.driver_id AND d.user_id = auth.uid()));

CREATE POLICY "ddn_settings public read" ON public.ddn_merchant_delivery_settings FOR SELECT USING (TRUE);
CREATE POLICY "ddn_settings merchant manage" ON public.ddn_merchant_delivery_settings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.gateway_merchants m WHERE m.id = ddn_merchant_delivery_settings.merchant_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.gateway_merchants m WHERE m.id = ddn_merchant_delivery_settings.merchant_id AND m.user_id = auth.uid()));

CREATE POLICY "ddn_assign driver read" ON public.ddn_assignments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ddn_drivers d WHERE d.id = ddn_assignments.driver_id AND d.user_id = auth.uid()));
CREATE POLICY "ddn_assign merchant read" ON public.ddn_assignments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.gateway_merchants m WHERE m.id = ddn_assignments.merchant_id AND m.user_id = auth.uid()));
CREATE POLICY "ddn_assign customer read" ON public.ddn_assignments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.daily_needs_orders o WHERE o.id = ddn_assignments.order_id AND o.user_id = auth.uid()));

CREATE POLICY "ddn_offers driver read" ON public.ddn_assignment_offers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ddn_drivers d WHERE d.id = ddn_assignment_offers.driver_id AND d.user_id = auth.uid()));
CREATE POLICY "ddn_offers driver update" ON public.ddn_assignment_offers FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ddn_drivers d WHERE d.id = ddn_assignment_offers.driver_id AND d.user_id = auth.uid()));

CREATE POLICY "ddn_proofs parties read" ON public.ddn_delivery_proofs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ddn_assignments a
    LEFT JOIN public.daily_needs_orders o ON o.id = a.order_id
    LEFT JOIN public.ddn_drivers d ON d.id = a.driver_id
    LEFT JOIN public.gateway_merchants m ON m.id = a.merchant_id
    WHERE a.id = ddn_delivery_proofs.assignment_id
      AND (o.user_id = auth.uid() OR d.user_id = auth.uid() OR m.user_id = auth.uid())
  ));

CREATE POLICY "ddn_wallet driver read" ON public.ddn_driver_wallets FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ddn_drivers d WHERE d.id = ddn_driver_wallets.driver_id AND d.user_id = auth.uid()));
CREATE POLICY "ddn_earnings driver read" ON public.ddn_driver_earnings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ddn_drivers d WHERE d.id = ddn_driver_earnings.driver_id AND d.user_id = auth.uid()));

-- Functions
CREATE OR REPLACE FUNCTION public.ddn_haversine_km(
  lat1 NUMERIC, lng1 NUMERIC, lat2 NUMERIC, lng2 NUMERIC
) RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE r CONSTANT NUMERIC := 6371;
  dlat NUMERIC; dlng NUMERIC; a NUMERIC;
BEGIN
  IF lat1 IS NULL OR lat2 IS NULL THEN RETURN NULL; END IF;
  dlat := radians(lat2 - lat1); dlng := radians(lng2 - lng1);
  a := sin(dlat/2)^2 + cos(radians(lat1))*cos(radians(lat2))*sin(dlng/2)^2;
  RETURN r * 2 * atan2(sqrt(a), sqrt(1-a));
END $$;

CREATE OR REPLACE FUNCTION public.ddn_find_best_driver(
  _assignment_id UUID, _max_radius_km NUMERIC DEFAULT 15
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_merchant_id UUID; v_pickup_lat NUMERIC; v_pickup_lng NUMERIC; v_mode TEXT; v_driver_id UUID;
BEGIN
  SELECT a.merchant_id, a.pickup_lat, a.pickup_lng INTO v_merchant_id, v_pickup_lat, v_pickup_lng
    FROM public.ddn_assignments a WHERE a.id = _assignment_id;
  SELECT mode INTO v_mode FROM public.ddn_merchant_delivery_settings WHERE merchant_id = v_merchant_id;
  v_mode := COALESCE(v_mode, 'hybrid');

  IF v_mode IN ('merchant','hybrid') THEN
    SELECT d.id INTO v_driver_id
      FROM public.ddn_drivers d
      LEFT JOIN public.ddn_driver_locations l ON l.driver_id = d.id
      LEFT JOIN public.ddn_assignment_offers o ON o.driver_id = d.id AND o.assignment_id = _assignment_id
      WHERE d.owner_merchant_id = v_merchant_id
        AND d.approval_status = 'approved' AND d.status = 'online' AND o.id IS NULL
        AND (v_pickup_lat IS NULL OR l.lat IS NULL
             OR public.ddn_haversine_km(l.lat,l.lng,v_pickup_lat,v_pickup_lng) <= _max_radius_km)
      ORDER BY public.ddn_haversine_km(COALESCE(l.lat,0),COALESCE(l.lng,0),COALESCE(v_pickup_lat,0),COALESCE(v_pickup_lng,0)) ASC,
               d.rating DESC, d.last_seen_at DESC NULLS LAST
      LIMIT 1;
    IF v_driver_id IS NOT NULL THEN RETURN v_driver_id; END IF;
  END IF;

  IF v_mode IN ('platform','hybrid') THEN
    SELECT d.id INTO v_driver_id
      FROM public.ddn_drivers d
      LEFT JOIN public.ddn_driver_locations l ON l.driver_id = d.id
      LEFT JOIN public.ddn_assignment_offers o ON o.driver_id = d.id AND o.assignment_id = _assignment_id
      WHERE d.mode = 'platform'
        AND d.approval_status = 'approved' AND d.status = 'online' AND o.id IS NULL
        AND (v_pickup_lat IS NULL OR l.lat IS NULL
             OR public.ddn_haversine_km(l.lat,l.lng,v_pickup_lat,v_pickup_lng) <= _max_radius_km)
      ORDER BY public.ddn_haversine_km(COALESCE(l.lat,0),COALESCE(l.lng,0),COALESCE(v_pickup_lat,0),COALESCE(v_pickup_lng,0)) ASC,
               d.rating DESC, d.last_seen_at DESC NULLS LAST
      LIMIT 1;
  END IF;
  RETURN v_driver_id;
END $$;
REVOKE ALL ON FUNCTION public.ddn_find_best_driver(UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ddn_find_best_driver(UUID, NUMERIC) TO service_role;

CREATE OR REPLACE FUNCTION public.ddn_offer_accept(_offer_id UUID, _driver_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_offer RECORD;
BEGIN
  SELECT o.*, d.user_id AS d_user_id INTO v_offer
    FROM public.ddn_assignment_offers o
    JOIN public.ddn_drivers d ON d.id = o.driver_id
    WHERE o.id = _offer_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','offer_not_found'); END IF;
  IF v_offer.d_user_id <> _driver_user_id THEN RETURN jsonb_build_object('ok',false,'error','forbidden'); END IF;
  IF v_offer.status <> 'offered' THEN RETURN jsonb_build_object('ok',false,'error','offer_'||v_offer.status); END IF;
  IF v_offer.expires_at < now() THEN
    UPDATE public.ddn_assignment_offers SET status='timed_out', responded_at=now() WHERE id=_offer_id;
    RETURN jsonb_build_object('ok',false,'error','expired');
  END IF;
  PERFORM 1 FROM public.ddn_assignments WHERE id = v_offer.assignment_id FOR UPDATE;
  UPDATE public.ddn_assignments
     SET driver_id = v_offer.driver_id, status='accepted', assigned_at = now(), updated_at = now()
   WHERE id = v_offer.assignment_id AND driver_id IS NULL;
  IF NOT FOUND THEN
    UPDATE public.ddn_assignment_offers SET status='superseded', responded_at=now() WHERE id=_offer_id;
    RETURN jsonb_build_object('ok',false,'error','already_assigned');
  END IF;
  UPDATE public.ddn_assignment_offers SET status='accepted', responded_at=now() WHERE id=_offer_id;
  UPDATE public.ddn_assignment_offers SET status='superseded', responded_at=now()
    WHERE assignment_id = v_offer.assignment_id AND id <> _offer_id AND status='offered';
  UPDATE public.ddn_drivers SET status='busy', updated_at=now() WHERE id = v_offer.driver_id;
  RETURN jsonb_build_object('ok',true,'assignment_id',v_offer.assignment_id);
END $$;
REVOKE ALL ON FUNCTION public.ddn_offer_accept(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ddn_offer_accept(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ddn_settle_delivery(_assignment_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_a RECORD;
BEGIN
  SELECT * INTO v_a FROM public.ddn_assignments WHERE id = _assignment_id FOR UPDATE;
  IF NOT FOUND OR v_a.driver_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
  IF v_a.status <> 'delivered' THEN RETURN jsonb_build_object('ok',false,'error','not_delivered'); END IF;
  IF EXISTS (SELECT 1 FROM public.ddn_driver_earnings WHERE assignment_id = _assignment_id) THEN
    RETURN jsonb_build_object('ok',true,'already_settled',true);
  END IF;
  INSERT INTO public.ddn_driver_earnings(driver_id, assignment_id, gross_fee_xaf, platform_fee_xaf, driver_earnings_xaf, status)
  VALUES (v_a.driver_id, _assignment_id, v_a.delivery_fee_xaf, v_a.platform_fee_xaf, v_a.driver_earnings_xaf, 'available');
  INSERT INTO public.ddn_driver_wallets(driver_id, available_xaf, lifetime_earned_xaf)
  VALUES (v_a.driver_id, v_a.driver_earnings_xaf, v_a.driver_earnings_xaf)
  ON CONFLICT (driver_id) DO UPDATE
    SET available_xaf = public.ddn_driver_wallets.available_xaf + EXCLUDED.available_xaf,
        lifetime_earned_xaf = public.ddn_driver_wallets.lifetime_earned_xaf + EXCLUDED.lifetime_earned_xaf,
        updated_at = now();
  UPDATE public.ddn_drivers SET status='online', total_deliveries = total_deliveries + 1, updated_at = now()
   WHERE id = v_a.driver_id;
  RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.ddn_settle_delivery(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ddn_settle_delivery(UUID) TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.ddn_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ddn_driver_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ddn_assignment_offers;
