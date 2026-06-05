
-- Maker-checker columns for Nium name correction reviews
ALTER TABLE public.nium_name_correction_requests
  ADD COLUMN IF NOT EXISTS maker_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS maker_at timestamptz,
  ADD COLUMN IF NOT EXISTS maker_decision text CHECK (maker_decision IN ('approved','rejected')),
  ADD COLUMN IF NOT EXISTS maker_note text;

-- Prevent the same admin acting as both maker and checker
CREATE OR REPLACE FUNCTION public.tg_nium_name_correction_maker_checker()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('approved','rejected')
     AND NEW.reviewed_by IS NOT NULL
     AND NEW.maker_id IS NOT NULL
     AND NEW.reviewed_by = NEW.maker_id THEN
    RAISE EXCEPTION 'maker_checker_violation: reviewer must differ from maker';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nium_name_correction_maker_checker
  ON public.nium_name_correction_requests;
CREATE TRIGGER nium_name_correction_maker_checker
  BEFORE INSERT OR UPDATE ON public.nium_name_correction_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_nium_name_correction_maker_checker();
