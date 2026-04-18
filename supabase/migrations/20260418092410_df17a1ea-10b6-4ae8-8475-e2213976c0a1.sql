
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code) WHERE referral_code IS NOT NULL;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_attempts int := 0;
BEGIN
  LOOP
    v_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));
    -- strip ambiguous chars
    v_code := translate(v_code, 'OI', 'XY');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_code);
    v_attempts := v_attempts + 1;
    EXIT WHEN v_attempts > 10;
  END LOOP;
  RETURN v_code;
END;
$$;

UPDATE public.profiles
SET referral_code = public.generate_referral_code()
WHERE referral_code IS NULL;

CREATE OR REPLACE FUNCTION public.assign_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_referral_code ON public.profiles;
CREATE TRIGGER trg_assign_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_referral_code();

CREATE UNIQUE INDEX IF NOT EXISTS uniq_customer_rewards_cashback_ref
  ON public.customer_rewards(user_id, reward_type, reference_id)
  WHERE reference_id IS NOT NULL;
