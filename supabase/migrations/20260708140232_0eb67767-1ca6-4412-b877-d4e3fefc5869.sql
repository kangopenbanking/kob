
UPDATE public.giveting_campaigns c
SET status = 'active',
    published_at = COALESCE(published_at, now()),
    updated_at = now()
WHERE c.status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.kyc_verifications k
    WHERE k.user_id = c.owner_user_id AND k.status = 'approved'
  );

CREATE OR REPLACE FUNCTION public.giveting_auto_publish_on_kyc_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.giveting_campaigns
    SET status = 'active',
        published_at = COALESCE(published_at, now()),
        updated_at = now()
    WHERE owner_user_id = NEW.user_id
      AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_giveting_auto_publish_on_kyc ON public.kyc_verifications;
CREATE TRIGGER trg_giveting_auto_publish_on_kyc
AFTER INSERT OR UPDATE OF status ON public.kyc_verifications
FOR EACH ROW EXECUTE FUNCTION public.giveting_auto_publish_on_kyc_approval();
