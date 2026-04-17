-- ============================================================================
-- Phase 14 follow-up: auto-fix F22, F23, F25
-- F22: support-attachments must not be world-readable
-- F23: shared buckets (pos-product-images, institution-assets, pwa-media)
--      must enforce ownership on UPDATE/DELETE (public SELECT preserved —
--      these buckets are intentionally public for display/branding)
-- F25: njangi_groups SELECT policy join bug (nm.group_id = nm.id) silently
--      hid groups from non-creator members
-- F24 deferred: realtime.messages lives in the reserved `realtime` schema,
--      which our governance forbids modifying.
-- ============================================================================

-- ───────────────────────────────────────────────────────────────────────────
-- F22 — support-attachments: restrict reads to owner (path = uid/...) and
-- service_role. Make bucket private.
-- ───────────────────────────────────────────────────────────────────────────
UPDATE storage.buckets SET public = false WHERE id = 'support-attachments';

DROP POLICY IF EXISTS "Anyone can view support files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload support files" ON storage.objects;

CREATE POLICY "Owners read own support attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Service role reads support attachments"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'support-attachments');

CREATE POLICY "Owners upload support attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'support-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owners delete own support attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ───────────────────────────────────────────────────────────────────────────
-- F23 — pos-product-images: enforce ownership on UPDATE/DELETE
-- (public SELECT retained for storefront browsing)
-- ───────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can delete own product images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;

CREATE POLICY "Owners upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pos-product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owners update own product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'pos-product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'pos-product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owners delete own product images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'pos-product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ───────────────────────────────────────────────────────────────────────────
-- F23 — institution-assets: ownership on UPDATE/DELETE/INSERT
-- ───────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can delete institution assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update institution assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload institution assets" ON storage.objects;

CREATE POLICY "Owners upload institution assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'institution-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owners update own institution assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'institution-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'institution-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owners delete own institution assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'institution-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ───────────────────────────────────────────────────────────────────────────
-- F23 — pwa-media: ownership on UPDATE/DELETE/INSERT
-- ───────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can delete pwa-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update pwa-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload pwa-media" ON storage.objects;

CREATE POLICY "Owners upload pwa-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pwa-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owners update own pwa-media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'pwa-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'pwa-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owners delete own pwa-media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'pwa-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ───────────────────────────────────────────────────────────────────────────
-- F25 — Fix njangi_groups SELECT policy join bug.
-- Use the existing SECURITY DEFINER helper public.is_njangi_group_member()
-- to avoid recursive RLS evaluation.
-- ───────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can read njangi groups" ON public.njangi_groups;

CREATE POLICY "Members can read njangi groups"
ON public.njangi_groups FOR SELECT
TO authenticated
USING (
  creator_id = auth.uid()
  OR public.is_njangi_group_member(auth.uid(), id)
);
