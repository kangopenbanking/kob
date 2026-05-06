-- QR-to-Card payments (links a virtual card debit to a downstream PISP payment)
create table if not exists public.qr_card_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  virtual_card_id uuid not null references public.virtual_cards(id) on delete restrict,
  pisp_payment_id text,
  qr_hash text not null,
  merchant_key text not null,
  merchant_name text,
  merchant_id text,
  merchant_external boolean not null default false,
  merchant_country text,
  merchant_category_code text,
  amount numeric(20,2) not null check (amount > 0),
  currency text not null check (char_length(currency) = 3),
  status text not null default 'pending' check (status in ('pending','completed','failed','refunded')),
  failure_reason text,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists qr_card_payments_user_idx on public.qr_card_payments(user_id, created_at desc);
create index if not exists qr_card_payments_card_idx on public.qr_card_payments(virtual_card_id);
create index if not exists qr_card_payments_pisp_idx on public.qr_card_payments(pisp_payment_id) where pisp_payment_id is not null;

alter table public.qr_card_payments enable row level security;

create policy "Users read own qr card payments"
  on public.qr_card_payments for select
  to authenticated
  using (user_id = auth.uid());

-- (no insert/update/delete policies → service role only via edge functions)

create or replace function public.qr_card_payments_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger qr_card_payments_updated_at
  before update on public.qr_card_payments
  for each row execute function public.qr_card_payments_set_updated_at();

-- External merchant cache (non-KOB merchants encountered via EMVCo QR)
create table if not exists public.qr_external_merchants (
  merchant_key text primary key,
  display_name text,
  country_code text,
  mcc text,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','verified','blocked')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.qr_external_merchants enable row level security;

create policy "Anyone can read qr external merchants"
  on public.qr_external_merchants for select
  to authenticated
  using (true);
-- writes via service role only
