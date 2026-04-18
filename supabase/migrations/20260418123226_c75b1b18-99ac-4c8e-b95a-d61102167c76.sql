-- Tighten loan_products: only the owning institution (bank) or platform admin can manage
DROP POLICY IF EXISTS "Authenticated users can view full loan product details" ON public.loan_products;

-- Allow institution owners and their admin staff to manage their own loan products
CREATE POLICY "Institution owners can manage their loan products"
ON public.loan_products
FOR ALL
TO authenticated
USING (
  institution_id IS NOT NULL
  AND (
    public.is_institution_owner(auth.uid(), institution_id)
    OR public.is_institution_staff_admin(auth.uid(), institution_id)
  )
)
WITH CHECK (
  institution_id IS NOT NULL
  AND (
    public.is_institution_owner(auth.uid(), institution_id)
    OR public.is_institution_staff_admin(auth.uid(), institution_id)
  )
);

-- Force institution_id on insert (banks must declare ownership) — admins exempt
CREATE OR REPLACE FUNCTION public.enforce_loan_product_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.institution_id IS NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Loan products must be owned by an institution (bank).';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_loan_product_ownership ON public.loan_products;
CREATE TRIGGER trg_enforce_loan_product_ownership
BEFORE INSERT OR UPDATE ON public.loan_products
FOR EACH ROW EXECUTE FUNCTION public.enforce_loan_product_ownership();

-- Same hardening for preapproved offers: ensure institution_id is real and caller owns it
CREATE OR REPLACE FUNCTION public.enforce_preapproved_offer_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.institution_id IS NULL THEN
    RAISE EXCEPTION 'Pre-approved offers must be owned by an institution (bank).';
  END IF;
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_institution_owner(auth.uid(), NEW.institution_id)
    OR public.is_institution_staff_admin(auth.uid(), NEW.institution_id)
  ) THEN
    RAISE EXCEPTION 'Only the owning bank (institution) can set pre-approved loan offers.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_preapproved_offer_ownership ON public.preapproved_loan_offers;
CREATE TRIGGER trg_enforce_preapproved_offer_ownership
BEFORE INSERT OR UPDATE ON public.preapproved_loan_offers
FOR EACH ROW EXECUTE FUNCTION public.enforce_preapproved_offer_ownership();