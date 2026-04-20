-- 1) Add developer_user_id column
ALTER TABLE public.api_clients
  ADD COLUMN IF NOT EXISTS developer_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_api_clients_developer_user_id
  ON public.api_clients(developer_user_id);

-- 2) Backfill from developer_email -> profiles.id
UPDATE public.api_clients ac
SET developer_user_id = p.id
FROM public.profiles p
WHERE ac.developer_user_id IS NULL
  AND ac.developer_email IS NOT NULL
  AND lower(p.email) = lower(ac.developer_email);

-- 3) Developer self-access policies (additive - existing institution + admin policies remain)
DROP POLICY IF EXISTS "Developers can view own API clients" ON public.api_clients;
CREATE POLICY "Developers can view own API clients"
ON public.api_clients
FOR SELECT
TO authenticated
USING (developer_user_id = auth.uid());

DROP POLICY IF EXISTS "Developers can deactivate own API clients" ON public.api_clients;
CREATE POLICY "Developers can deactivate own API clients"
ON public.api_clients
FOR UPDATE
TO authenticated
USING (developer_user_id = auth.uid())
WITH CHECK (developer_user_id = auth.uid());