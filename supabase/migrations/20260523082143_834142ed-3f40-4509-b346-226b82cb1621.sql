
-- 1) nav-icons bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('nav-icons', 'nav-icons', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read nav-icons"
ON storage.objects FOR SELECT
USING (bucket_id = 'nav-icons');

CREATE POLICY "Admins upload nav-icons"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'nav-icons' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update nav-icons"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'nav-icons' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins delete nav-icons"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'nav-icons' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) credit_profiles: basic check gate + nullable score
ALTER TABLE public.credit_profiles
  ADD COLUMN IF NOT EXISTS basic_check_passed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS basic_check_completed_at timestamptz;

ALTER TABLE public.credit_profiles
  ALTER COLUMN current_score DROP NOT NULL,
  ALTER COLUMN current_score DROP DEFAULT;
