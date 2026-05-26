GRANT SELECT, INSERT, UPDATE, DELETE ON public.pay_by_bank_intents TO authenticated;
GRANT ALL ON public.pay_by_bank_intents TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pisp_consents TO authenticated;
GRANT ALL ON public.pisp_consents TO service_role;

GRANT SELECT ON public.tpp_registrations TO authenticated;
GRANT ALL ON public.tpp_registrations TO service_role;