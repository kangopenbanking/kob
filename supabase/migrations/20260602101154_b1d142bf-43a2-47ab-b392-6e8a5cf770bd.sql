CREATE POLICY "service_role manages serial counters"
ON public.statement_serial_counters
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);