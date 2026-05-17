
-- Add only the missing columns (additive, no rename/removal)
ALTER TABLE public.reconciliation_mismatches
  ADD COLUMN IF NOT EXISTS assignee UUID,
  ADD COLUMN IF NOT EXISTS settlement_id UUID,
  ADD COLUMN IF NOT EXISTS ledger_batch_id UUID,
  ADD COLUMN IF NOT EXISTS priority TEXT,
  ADD COLUMN IF NOT EXISTS detected_by TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_recon_mismatches_resolution
  ON public.reconciliation_mismatches(resolution_status);
CREATE INDEX IF NOT EXISTS idx_recon_mismatches_assignee
  ON public.reconciliation_mismatches(assignee);
CREATE INDEX IF NOT EXISTS idx_recon_mismatches_created
  ON public.reconciliation_mismatches(created_at DESC);

-- Immutable, admin-only audit exports bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('audit-exports', 'audit-exports', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Admins read audit-exports'
  ) THEN
    CREATE POLICY "Admins read audit-exports"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'audit-exports' AND public.has_role(auth.uid(), 'admin'));
  END IF;
END$$;
