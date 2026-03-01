
-- Create institution-assets storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('institution-assets', 'institution-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to institution-assets
CREATE POLICY "Authenticated users can upload institution assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'institution-assets');

-- Allow public read access to institution-assets
CREATE POLICY "Public read access for institution assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'institution-assets');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update institution assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'institution-assets');

-- Allow authenticated users to delete institution assets
CREATE POLICY "Authenticated users can delete institution assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'institution-assets');
