
-- Customer uploads to a folder named after their user id
CREATE POLICY "dn_rx_user_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'daily-needs-prescriptions'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "dn_rx_user_read_own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'daily-needs-prescriptions'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "dn_rx_user_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'daily-needs-prescriptions'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Pharmacy merchants & admins can read any rx in the bucket (scoping enforced at app/edge layer)
CREATE POLICY "dn_rx_merchant_admin_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'daily-needs-prescriptions'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.daily_needs_stores s
      JOIN public.gateway_merchants gm ON gm.id = s.merchant_id
      WHERE gm.user_id = auth.uid()
        AND s.vertical = 'pharmacy'
    )
  )
);
