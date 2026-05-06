alter table public.qr_card_payments alter column user_id drop not null;
alter table public.qr_payment_idempotency alter column user_id drop not null;
alter table public.qr_payment_idempotency
  add column if not exists owner_key text;
create index if not exists qr_payment_idempotency_owner_idx
  on public.qr_payment_idempotency(owner_key)
  where owner_key is not null;
