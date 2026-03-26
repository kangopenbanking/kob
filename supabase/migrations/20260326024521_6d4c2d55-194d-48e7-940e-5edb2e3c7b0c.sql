-- Drop overly restrictive unique constraint that prevents multiple corridors per partner
ALTER TABLE public.remittance_corridors DROP CONSTRAINT remittance_corridors_partner_id_from_country_from_currency_key;

-- Add proper unique constraint including destination and direction
ALTER TABLE public.remittance_corridors ADD CONSTRAINT remittance_corridors_partner_route_unique
  UNIQUE (partner_id, from_country, to_country, from_currency, to_currency, direction);