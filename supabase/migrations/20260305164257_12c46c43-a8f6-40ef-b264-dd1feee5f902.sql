
-- ============================================================
-- TRANSPORT & TOURISM TABLES
-- ============================================================

-- 1. travel_services: Links merchant to a transport category
CREATE TABLE public.travel_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.gateway_merchants(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL CHECK (service_type IN ('bus', 'tours', 'airlines', 'trains')),
  display_name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  theme_color TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, service_type)
);

-- 2. travel_routes: Origin → Destination corridors
CREATE TABLE public.travel_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.travel_services(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  distance_km NUMERIC,
  estimated_duration_minutes INT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. travel_seating_plans: Flexible seat layout templates
CREATE TABLE public.travel_seating_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.travel_services(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL,
  rows INT NOT NULL,
  columns INT NOT NULL,
  layout JSONB NOT NULL DEFAULT '[]',
  total_seats INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. travel_trips: Specific scheduled journeys
CREATE TABLE public.travel_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.travel_routes(id) ON DELETE CASCADE,
  seating_plan_id UUID REFERENCES public.travel_seating_plans(id),
  departure_at TIMESTAMPTZ NOT NULL,
  arrival_at TIMESTAMPTZ NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'XAF',
  available_seats INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'boarding', 'departed', 'completed', 'cancelled')),
  vehicle_info TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. travel_bookings: Customer booking records
CREATE TABLE public.travel_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.travel_trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  booking_ref TEXT NOT NULL UNIQUE,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'XAF',
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  booking_status TEXT NOT NULL DEFAULT 'confirmed' CHECK (booking_status IN ('confirmed', 'cancelled', 'completed')),
  payment_method TEXT DEFAULT 'wallet',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. travel_tickets: Individual e-tickets per seat
CREATE TABLE public.travel_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.travel_bookings(id) ON DELETE CASCADE,
  seat_label TEXT NOT NULL,
  passenger_name TEXT NOT NULL,
  passenger_phone TEXT,
  qr_code TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  ticket_status TEXT NOT NULL DEFAULT 'valid' CHECK (ticket_status IN ('valid', 'used', 'cancelled', 'expired')),
  validated_at TIMESTAMPTZ,
  validated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. travel_timetables: Weekly recurring schedule templates
CREATE TABLE public.travel_timetables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.travel_routes(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  departure_time TIME NOT NULL,
  arrival_time TIME NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_travel_services_merchant ON public.travel_services(merchant_id);
CREATE INDEX idx_travel_routes_service ON public.travel_routes(service_id);
CREATE INDEX idx_travel_trips_route ON public.travel_trips(route_id);
CREATE INDEX idx_travel_trips_departure ON public.travel_trips(departure_at);
CREATE INDEX idx_travel_bookings_user ON public.travel_bookings(user_id);
CREATE INDEX idx_travel_bookings_trip ON public.travel_bookings(trip_id);
CREATE INDEX idx_travel_tickets_booking ON public.travel_tickets(booking_id);
CREATE INDEX idx_travel_tickets_qr ON public.travel_tickets(qr_code);
CREATE INDEX idx_travel_timetables_route ON public.travel_timetables(route_id);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.travel_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_seating_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_timetables ENABLE ROW LEVEL SECURITY;

-- Helper: check if user owns a travel_service via gateway_merchants
CREATE OR REPLACE FUNCTION public.is_travel_service_owner(_user_id UUID, _service_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.travel_services ts
    JOIN public.gateway_merchants gm ON gm.id = ts.merchant_id
    WHERE ts.id = _service_id AND gm.user_id = _user_id
  )
$$;

-- travel_services: Merchants manage their own; public reads active
CREATE POLICY "Anyone can view active travel services"
  ON public.travel_services FOR SELECT
  USING (is_active = true);

CREATE POLICY "Merchants manage own travel services"
  ON public.travel_services FOR ALL
  TO authenticated
  USING (merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid()))
  WITH CHECK (merchant_id IN (SELECT id FROM public.gateway_merchants WHERE user_id = auth.uid()));

-- travel_routes: Public reads active; merchants manage via service ownership
CREATE POLICY "Anyone can view active travel routes"
  ON public.travel_routes FOR SELECT
  USING (is_active = true);

CREATE POLICY "Merchants manage own travel routes"
  ON public.travel_routes FOR ALL
  TO authenticated
  USING (public.is_travel_service_owner(auth.uid(), service_id))
  WITH CHECK (public.is_travel_service_owner(auth.uid(), service_id));

-- travel_seating_plans: Public reads; merchants manage via service
CREATE POLICY "Anyone can view seating plans"
  ON public.travel_seating_plans FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Merchants manage own seating plans"
  ON public.travel_seating_plans FOR ALL
  TO authenticated
  USING (public.is_travel_service_owner(auth.uid(), service_id))
  WITH CHECK (public.is_travel_service_owner(auth.uid(), service_id));

-- travel_trips: Public reads scheduled; merchants manage via route→service
CREATE POLICY "Anyone can view scheduled trips"
  ON public.travel_trips FOR SELECT
  USING (status IN ('scheduled', 'boarding'));

CREATE POLICY "Merchants manage own trips"
  ON public.travel_trips FOR ALL
  TO authenticated
  USING (route_id IN (
    SELECT tr.id FROM public.travel_routes tr
    WHERE public.is_travel_service_owner(auth.uid(), tr.service_id)
  ))
  WITH CHECK (route_id IN (
    SELECT tr.id FROM public.travel_routes tr
    WHERE public.is_travel_service_owner(auth.uid(), tr.service_id)
  ));

-- travel_bookings: Users see own bookings; merchants see bookings for their trips
CREATE POLICY "Users view own bookings"
  ON public.travel_bookings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users create own bookings"
  ON public.travel_bookings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Merchants view bookings for their trips"
  ON public.travel_bookings FOR SELECT
  TO authenticated
  USING (trip_id IN (
    SELECT tt.id FROM public.travel_trips tt
    JOIN public.travel_routes tr ON tr.id = tt.route_id
    WHERE public.is_travel_service_owner(auth.uid(), tr.service_id)
  ));

-- travel_tickets: Users see own tickets; merchants see tickets for their trips
CREATE POLICY "Users view own tickets"
  ON public.travel_tickets FOR SELECT
  TO authenticated
  USING (booking_id IN (SELECT id FROM public.travel_bookings WHERE user_id = auth.uid()));

CREATE POLICY "Users create own tickets"
  ON public.travel_tickets FOR INSERT
  TO authenticated
  WITH CHECK (booking_id IN (SELECT id FROM public.travel_bookings WHERE user_id = auth.uid()));

CREATE POLICY "Merchants view and validate tickets"
  ON public.travel_tickets FOR ALL
  TO authenticated
  USING (booking_id IN (
    SELECT tb.id FROM public.travel_bookings tb
    JOIN public.travel_trips tt ON tt.id = tb.trip_id
    JOIN public.travel_routes tr ON tr.id = tt.route_id
    WHERE public.is_travel_service_owner(auth.uid(), tr.service_id)
  ));

-- travel_timetables: Public reads active; merchants manage via route→service
CREATE POLICY "Anyone can view active timetables"
  ON public.travel_timetables FOR SELECT
  USING (is_active = true);

CREATE POLICY "Merchants manage own timetables"
  ON public.travel_timetables FOR ALL
  TO authenticated
  USING (route_id IN (
    SELECT tr.id FROM public.travel_routes tr
    WHERE public.is_travel_service_owner(auth.uid(), tr.service_id)
  ))
  WITH CHECK (route_id IN (
    SELECT tr.id FROM public.travel_routes tr
    WHERE public.is_travel_service_owner(auth.uid(), tr.service_id)
  ));

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.update_travel_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_travel_services_updated BEFORE UPDATE ON public.travel_services FOR EACH ROW EXECUTE FUNCTION public.update_travel_updated_at();
CREATE TRIGGER trg_travel_routes_updated BEFORE UPDATE ON public.travel_routes FOR EACH ROW EXECUTE FUNCTION public.update_travel_updated_at();
CREATE TRIGGER trg_travel_seating_plans_updated BEFORE UPDATE ON public.travel_seating_plans FOR EACH ROW EXECUTE FUNCTION public.update_travel_updated_at();
CREATE TRIGGER trg_travel_trips_updated BEFORE UPDATE ON public.travel_trips FOR EACH ROW EXECUTE FUNCTION public.update_travel_updated_at();
