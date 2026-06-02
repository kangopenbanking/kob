
-- Phase 7: Daily Needs transport / shipping provider integration

CREATE TYPE public.dn_delivery_provider AS ENUM ('internal', 'external');

CREATE TABLE public.daily_needs_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text NOT NULL,
  phone text NOT NULL,
  vehicle_type text NOT NULL DEFAULT 'moto',
  vehicle_plate text,
  is_online boolean NOT NULL DEFAULT false,
  current_latitude numeric(9,6),
  current_longitude numeric(9,6),
  last_seen_at timestamptz,
  rating numeric(3,2) NOT NULL DEFAULT 5.00,
  total_deliveries integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dn_drivers_online ON public.daily_needs_drivers(is_online) WHERE is_online = true;
CREATE INDEX idx_dn_drivers_location ON public.daily_needs_drivers(current_latitude, current_longitude);

GRANT SELECT, INSERT, UPDATE ON public.daily_needs_drivers TO authenticated;
GRANT ALL ON public.daily_needs_drivers TO service_role;

ALTER TABLE public.daily_needs_drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers manage own profile" ON public.daily_needs_drivers
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins view all drivers" ON public.daily_needs_drivers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_dn_drivers_updated BEFORE UPDATE ON public.daily_needs_drivers
  FOR EACH ROW EXECUTE FUNCTION public.dn_touch_updated_at();

-- Extend assignments with provider + external tracking
ALTER TABLE public.daily_needs_delivery_assignments
  ADD COLUMN provider public.dn_delivery_provider NOT NULL DEFAULT 'internal',
  ADD COLUMN external_provider text,
  ADD COLUMN external_tracking_id text,
  ADD COLUMN pickup_address text,
  ADD COLUMN dropoff_address text,
  ADD COLUMN pickup_latitude numeric(9,6),
  ADD COLUMN pickup_longitude numeric(9,6),
  ADD COLUMN dropoff_latitude numeric(9,6),
  ADD COLUMN dropoff_longitude numeric(9,6),
  ADD COLUMN estimated_distance_km numeric(6,2),
  ADD COLUMN estimated_eta_minutes integer,
  ADD COLUMN status text NOT NULL DEFAULT 'assigned';

CREATE INDEX idx_dn_deliveries_external ON public.daily_needs_delivery_assignments(external_provider, external_tracking_id)
  WHERE external_tracking_id IS NOT NULL;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_needs_drivers;

-- Haversine helper (km) for nearest-driver lookup
CREATE OR REPLACE FUNCTION public.dn_haversine_km(
  lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric
) RETURNS numeric
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    power(sin(radians(lon2 - lon1) / 2), 2)
  ))::numeric
$$;

-- Find nearest online driver within radius_km of pickup point
CREATE OR REPLACE FUNCTION public.dn_find_nearest_driver(
  _lat numeric, _lon numeric, _radius_km numeric DEFAULT 10
) RETURNS TABLE (driver_id uuid, user_id uuid, distance_km numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.user_id,
    public.dn_haversine_km(_lat, _lon, d.current_latitude, d.current_longitude) AS distance_km
  FROM public.daily_needs_drivers d
  WHERE d.is_online = true
    AND d.current_latitude IS NOT NULL
    AND d.current_longitude IS NOT NULL
    AND public.dn_haversine_km(_lat, _lon, d.current_latitude, d.current_longitude) <= _radius_km
    AND NOT EXISTS (
      SELECT 1 FROM public.daily_needs_delivery_assignments a
      WHERE a.driver_id = d.user_id
        AND a.delivered_at IS NULL
    )
  ORDER BY distance_km ASC
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.dn_find_nearest_driver(numeric, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dn_find_nearest_driver(numeric, numeric, numeric) TO service_role;
