ALTER TABLE public.fee_structures DROP CONSTRAINT fee_structures_transaction_type_check;
ALTER TABLE public.fee_structures ADD CONSTRAINT fee_structures_transaction_type_check CHECK (transaction_type = ANY (ARRAY['transfer','payment','bill_payment','mobile_money_transfer','mobile_money_charge','withdrawal','deposit','piggybank','njangi','rent','international_transfer','card_payment','p2p','cashout']));

INSERT INTO public.fee_structures (
  institution_id, transaction_type, fee_model, fixed_amount, percentage_rate,
  min_fee_amount, max_fee_amount, is_active, effective_from
) VALUES (
  'f493095b-037a-40cf-82bc-3a3ab74550dd',
  'withdrawal',
  'percentage',
  0,
  1.5,
  100,
  5000,
  true,
  CURRENT_DATE
);