
-- Allow anonymous (public) users to read active corridors
CREATE POLICY "Public read active corridors"
  ON public.remittance_corridors
  FOR SELECT
  TO anon
  USING (is_active = true);

-- Allow anonymous (public) users to read active partners
CREATE POLICY "Public read active partners"
  ON public.remittance_partners
  FOR SELECT
  TO anon
  USING (status = 'active');

-- Also allow anon to read exchange rates for the form
CREATE POLICY "Public read active exchange rates"
  ON public.admin_exchange_rates
  FOR SELECT
  TO anon
  USING (is_active = true);
