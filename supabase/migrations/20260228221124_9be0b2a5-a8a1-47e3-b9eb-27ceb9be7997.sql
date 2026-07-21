ALTER TABLE public.fee_structures DROP CONSTRAINT fee_structures_transaction_type_check;
ALTER TABLE public.fee_structures ADD CONSTRAINT fee_structures_transaction_type_check CHECK (transaction_type = ANY (ARRAY['transfer','payment','bill_payment','mobile_money_transfer','mobile_money_charge','withdrawal','deposit','piggybank','njangi','rent','international_transfer','card_payment','p2p','cashout']));

-- Parent-aware, idempotent insertion of the Kang platform withdrawal fee
-- structure. On a clean disposable database the parent institution row does
-- not exist; the SELECT yields zero rows and the INSERT is a safe no-op.
-- The foreign key remains enforced; no synthetic institution is fabricated.
INSERT INTO public.fee_structures (
  institution_id,
  transaction_type,
  fee_model,
  fixed_amount,
  percentage_rate,
  min_fee_amount,
  max_fee_amount,
  is_active,
  effective_from
)
SELECT
  i.id,
  'withdrawal',
  'percentage',
  0,
  1.5,
  100,
  5000,
  true,
  CURRENT_DATE
FROM public.institutions AS i
WHERE i.id = 'f493095b-037a-40cf-82bc-3a3ab74550dd'::uuid
  AND NOT EXISTS (
    SELECT 1
    FROM public.fee_structures AS fs
    WHERE fs.institution_id = i.id
      AND fs.transaction_type = 'withdrawal'
      AND fs.effective_from = CURRENT_DATE
  );
