-- Allow all authenticated users to read the Kang platform institution record
-- This is needed so customer app users can load hero images, branding, and feature config
CREATE POLICY "Authenticated users can read platform institution"
ON public.institutions
FOR SELECT
TO authenticated
USING (id = 'f493095b-037a-40cf-82bc-3a3ab74550dd'::uuid);