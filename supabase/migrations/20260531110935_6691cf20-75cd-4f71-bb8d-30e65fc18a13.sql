-- Dedupe existing platform-scope duplicates: deactivate older rows, keep the most recently created per (transaction_type, effective_from)
WITH dups AS (
  SELECT id,
         row_number() OVER (PARTITION BY transaction_type, effective_from ORDER BY created_at DESC, id DESC) AS rn
  FROM public.fee_structures
  WHERE institution_id IS NULL AND fee_scope = 'platform'
)
UPDATE public.fee_structures fs
SET is_active = false,
    effective_until = COALESCE(effective_until, CURRENT_DATE)
FROM dups
WHERE fs.id = dups.id AND dups.rn > 1;

-- Now physically remove the redundant deactivated duplicates so the unique index can be created
DELETE FROM public.fee_structures fs
USING (
  SELECT id,
         row_number() OVER (PARTITION BY transaction_type, effective_from ORDER BY created_at DESC, id DESC) AS rn
  FROM public.fee_structures
  WHERE institution_id IS NULL AND fee_scope = 'platform'
) d
WHERE fs.id = d.id AND d.rn > 1;

-- Partial unique index: one active platform-scope row per (transaction_type, effective_from)
CREATE UNIQUE INDEX IF NOT EXISTS fee_structures_platform_unique
  ON public.fee_structures (transaction_type, effective_from)
  WHERE institution_id IS NULL AND fee_scope = 'platform';

-- Partial unique index for institution scope including fee_scope
CREATE UNIQUE INDEX IF NOT EXISTS fee_structures_institution_unique
  ON public.fee_structures (institution_id, transaction_type, effective_from, fee_scope)
  WHERE institution_id IS NOT NULL;
