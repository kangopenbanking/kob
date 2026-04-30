-- Additive columns (Standing Order 4 — Surgeon Rule)
ALTER TABLE public.gateway_merchants
  ADD COLUMN IF NOT EXISTS kyb_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyb_reviewed_at  TIMESTAMPTZ;

-- Backfill so the admin review queue has data to display immediately.
UPDATE public.gateway_merchants
   SET kyb_submitted_at = COALESCE(kyb_submitted_at, created_at)
 WHERE kyb_status IN ('submitted','under_review','verified','rejected','VERIFIED','SUSPENDED');

UPDATE public.gateway_merchants
   SET kyb_reviewed_at = COALESCE(kyb_reviewed_at, updated_at)
 WHERE kyb_status IN ('verified','rejected','VERIFIED','SUSPENDED');

-- Keep the review queue fast when sorted by submission date.
CREATE INDEX IF NOT EXISTS idx_gateway_merchants_kyb_submitted_at
  ON public.gateway_merchants (kyb_submitted_at DESC NULLS LAST);

-- Auto-stamp kyb_submitted_at when kyb_status transitions into a review state,
-- and kyb_reviewed_at when it transitions to a terminal review state.
CREATE OR REPLACE FUNCTION public.gateway_merchants_kyb_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.kyb_status IN ('submitted','under_review') AND NEW.kyb_submitted_at IS NULL THEN
      NEW.kyb_submitted_at := now();
    END IF;
    IF NEW.kyb_status IN ('verified','rejected','VERIFIED','SUSPENDED') AND NEW.kyb_reviewed_at IS NULL THEN
      NEW.kyb_reviewed_at := now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.kyb_status IS DISTINCT FROM OLD.kyb_status THEN
      IF NEW.kyb_status IN ('submitted','under_review') AND NEW.kyb_submitted_at IS NULL THEN
        NEW.kyb_submitted_at := now();
      END IF;
      IF NEW.kyb_status IN ('verified','rejected','VERIFIED','SUSPENDED') AND NEW.kyb_reviewed_at IS NULL THEN
        NEW.kyb_reviewed_at := now();
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gateway_merchants_kyb_timestamps ON public.gateway_merchants;
CREATE TRIGGER trg_gateway_merchants_kyb_timestamps
  BEFORE INSERT OR UPDATE OF kyb_status ON public.gateway_merchants
  FOR EACH ROW EXECUTE FUNCTION public.gateway_merchants_kyb_timestamps();