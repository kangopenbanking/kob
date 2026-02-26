
-- Add RLS policies for kyc-documents bucket (bucket already exists)

-- Users can upload to their own folder
CREATE POLICY "Users upload own KYC docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Users can read their own docs
CREATE POLICY "Users read own KYC docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Admins can read all docs for review
CREATE POLICY "Admins read all KYC docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'kyc-documents' AND public.has_role(auth.uid(), 'admin'));
