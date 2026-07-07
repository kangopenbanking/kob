
-- RLS for giveting-covers bucket
CREATE POLICY "giveting_covers_read_all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'giveting-covers');

CREATE POLICY "giveting_covers_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'giveting-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "giveting_covers_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'giveting-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "giveting_covers_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'giveting-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
