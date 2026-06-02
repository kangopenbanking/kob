
-- 1. Fix linter ERROR 0010 — make merchant_qr_directory respect caller RLS
ALTER VIEW public.merchant_qr_directory SET (security_invoker = true);

-- 2. Drop overly-broad public SELECT policies (listing-enables) on user-content buckets.
--    Public URL reads still work because buckets are marked public at the storage layer.
DROP POLICY IF EXISTS "Avatar images are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Public read storefront assets" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for institution assets" ON storage.objects;

-- 3. Tighten gateway_audit_logs insert: was qual=true / roles=public.
DROP POLICY IF EXISTS "Service role inserts gateway audit logs" ON public.gateway_audit_logs;
CREATE POLICY "Service role inserts gateway audit logs"
ON public.gateway_audit_logs
FOR INSERT
TO service_role
WITH CHECK (true);
