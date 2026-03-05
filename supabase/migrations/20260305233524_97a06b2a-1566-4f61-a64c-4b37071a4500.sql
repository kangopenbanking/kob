
CREATE TABLE public.travel_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.travel_services(id) ON DELETE CASCADE,
  discount_name TEXT NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL DEFAULT 0,
  min_seats INTEGER DEFAULT 1,
  max_uses INTEGER DEFAULT NULL,
  current_uses INTEGER DEFAULT 0,
  promo_code TEXT DEFAULT NULL,
  is_active BOOLEAN DEFAULT true,
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ DEFAULT NULL,
  applies_to_routes UUID[] DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.travel_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can manage own discounts"
ON public.travel_discounts
FOR ALL
TO authenticated
USING (public.is_travel_service_owner(auth.uid(), service_id))
WITH CHECK (public.is_travel_service_owner(auth.uid(), service_id));

CREATE POLICY "Anyone can read active discounts"
ON public.travel_discounts
FOR SELECT
TO authenticated
USING (is_active = true);

CREATE TRIGGER update_travel_discounts_updated_at
  BEFORE UPDATE ON public.travel_discounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_travel_updated_at();
