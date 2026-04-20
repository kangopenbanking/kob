
-- Enable Realtime for KYC/KYB live admin & customer sync
ALTER TABLE public.kyc_verifications REPLICA IDENTITY FULL;
ALTER TABLE public.business_kyc REPLICA IDENTITY FULL;
ALTER TABLE public.sanctions_screening REPLICA IDENTITY FULL;
ALTER TABLE public.gateway_merchants REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='kyc_verifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.kyc_verifications;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='business_kyc') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.business_kyc;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='sanctions_screening') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sanctions_screening;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='gateway_merchants') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gateway_merchants;
  END IF;
END $$;

-- Allow users to UPDATE / re-upload their own KYC documents (re-submission after rejection)
DROP POLICY IF EXISTS "Users can update own KYC documents" ON storage.objects;
CREATE POLICY "Users can update own KYC documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow institution staff to view KYC documents of their customers
DROP POLICY IF EXISTS "Institution staff can read customer KYC docs" ON storage.objects;
CREATE POLICY "Institution staff can read customer KYC docs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.user_id::text = (storage.foldername(name))[1]
      AND a.is_active = true
      AND (
        EXISTS (SELECT 1 FROM public.institutions i WHERE i.id = a.institution_id AND i.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.staff_assignments sa WHERE sa.institution_id = a.institution_id AND sa.user_id = auth.uid() AND sa.is_active = true)
      )
  )
);
