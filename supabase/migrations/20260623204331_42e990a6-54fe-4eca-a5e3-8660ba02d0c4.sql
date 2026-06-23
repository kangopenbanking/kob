-- PTP: Missed-payment fee configuration (additive, backwards-compatible)

ALTER TABLE public.loan_products
  ADD COLUMN IF NOT EXISTS ptp_missed_fee_enabled    boolean        NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ptp_missed_fee_type       text           NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS ptp_missed_fee_value      numeric(18,4)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ptp_missed_fee_cap        numeric(18,2),
  ADD COLUMN IF NOT EXISTS ptp_missed_fee_grace_days integer        NOT NULL DEFAULT 1;

ALTER TABLE public.loan_products
  DROP CONSTRAINT IF EXISTS loan_products_ptp_missed_fee_type_check;
ALTER TABLE public.loan_products
  ADD CONSTRAINT loan_products_ptp_missed_fee_type_check
    CHECK (ptp_missed_fee_type IN ('fixed','percentage'));

ALTER TABLE public.loan_products
  DROP CONSTRAINT IF EXISTS loan_products_ptp_missed_fee_value_check;
ALTER TABLE public.loan_products
  ADD CONSTRAINT loan_products_ptp_missed_fee_value_check
    CHECK (ptp_missed_fee_value >= 0);

ALTER TABLE public.loan_products
  DROP CONSTRAINT IF EXISTS loan_products_ptp_missed_fee_grace_check;
ALTER TABLE public.loan_products
  ADD CONSTRAINT loan_products_ptp_missed_fee_grace_check
    CHECK (ptp_missed_fee_grace_days >= 0);

-- Snapshot fee state on the promise itself
ALTER TABLE public.promise_to_pay
  ADD COLUMN IF NOT EXISTS missed_fee_amount     numeric(18,2),
  ADD COLUMN IF NOT EXISTS missed_fee_currency   text,
  ADD COLUMN IF NOT EXISTS missed_fee_type       text,
  ADD COLUMN IF NOT EXISTS missed_fee_charged_at timestamptz,
  ADD COLUMN IF NOT EXISTS missed_fee_reference  text;

-- Expand promise_to_pay_events.event_type to include fee_charged / fee_waived
ALTER TABLE public.promise_to_pay_events
  DROP CONSTRAINT IF EXISTS promise_to_pay_events_event_type_check;
ALTER TABLE public.promise_to_pay_events
  ADD CONSTRAINT promise_to_pay_events_event_type_check
    CHECK (event_type IN (
      'created','reminder_sent','payment_matched','kept','partial',
      'broken','rescheduled','cancelled',
      'fee_charged','fee_waived',
      'admin_cancel','admin_reschedule','admin_override_credit'
    ));