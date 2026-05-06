alter table public.qr_payment_idempotency
  alter column merchant_id drop not null,
  alter column amount drop not null,
  add column if not exists request_hash text,
  add column if not exists response_status int,
  add column if not exists qr_card_payment_id uuid references public.qr_card_payments(id) on delete set null,
  add column if not exists expires_at timestamptz not null default (now() + interval '24 hours');

create index if not exists qr_payment_idempotency_expires_idx
  on public.qr_payment_idempotency(expires_at);

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='qr_payment_idempotency'
      and policyname='Users read own qr idempotency entries'
  ) then
    create policy "Users read own qr idempotency entries"
      on public.qr_payment_idempotency for select
      to authenticated
      using (user_id = auth.uid());
  end if;
end $$;