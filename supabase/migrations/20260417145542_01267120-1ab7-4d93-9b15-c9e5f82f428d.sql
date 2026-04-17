DROP POLICY IF EXISTS "Service role manages payments" ON public.bill_payments;
CREATE POLICY "Service role manages payments"
  ON public.bill_payments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own OTP records" ON public.phone_otp_codes;