
-- Create storage bucket for storefront assets (logos, covers)
INSERT INTO storage.buckets (id, name, public)
VALUES ('storefront-assets', 'storefront-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload storefront assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'storefront-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to update their own files
CREATE POLICY "Users can update own storefront assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'storefront-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read access
CREATE POLICY "Public read storefront assets"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'storefront-assets');

-- Allow users to delete their own files
CREATE POLICY "Users can delete own storefront assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'storefront-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
