
-- KYC integrity hardening: enforce required document URLs at the DB level,
-- prevent concurrent active submissions per user, and clean up legacy
-- orphan rows that have no uploaded files (these polluted the admin queue).

-- 1. Validation trigger: identity submissions must carry a front URL and selfie URL.
CREATE OR REPLACE FUNCTION public.validate_kyc_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.verification_type = 'identity' THEN
    IF NEW.document_front_url IS NULL OR length(trim(NEW.document_front_url)) = 0 THEN
      RAISE EXCEPTION 'document_front_url is required for identity verification'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.selfie_url IS NULL OR length(trim(NEW.selfie_url)) = 0 THEN
      RAISE EXCEPTION 'selfie_url is required for identity verification'
        USING ERRCODE = '23514';
    END IF;
    -- Block accidental http(s) public URLs — we store storage paths only.
    IF NEW.document_front_url ILIKE 'http://%' OR NEW.document_front_url ILIKE 'https://%' THEN
      RAISE EXCEPTION 'document_front_url must be a storage path, not a public URL'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_kyc_submission ON public.kyc_verifications;
CREATE TRIGGER trg_validate_kyc_submission
  BEFORE INSERT ON public.kyc_verifications
  FOR EACH ROW EXECUTE FUNCTION public.validate_kyc_submission();

-- 2. Clean up legacy orphan rows that have NO document URLs at all — they
--    cannot be reviewed and only confuse the admin queue.
DELETE FROM public.kyc_verifications
WHERE (document_front_url IS NULL OR length(trim(document_front_url)) = 0)
  AND (selfie_url IS NULL OR length(trim(selfie_url)) = 0)
  AND status = 'pending';

-- 3. Partial unique index: one active (pending/approved) submission per user.
--    Backstops the edge-function dedup so concurrent calls can't both win.
CREATE UNIQUE INDEX IF NOT EXISTS kyc_verifications_one_active_per_user
  ON public.kyc_verifications (user_id)
  WHERE status IN ('pending', 'approved');
