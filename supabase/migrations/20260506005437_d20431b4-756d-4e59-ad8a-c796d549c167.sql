-- v4.31.0 — Partner-mode QR acceptance.
create table if not exists public.partner_card_tokens (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  partner_cardholder_ref text not null,
  network_token text not null,
  brand text,
  last4 text check (last4 ~ '^[0-9]{4}$'),
  status text not null default 'active' check (status in ('active','revoked','expired')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, partner_cardholder_ref, network_token)
);
create index if not exists partner_card_tokens_client_idx on public.partner_card_tokens(client_id, status);
alter table public.partner_card_tokens enable row level security;
drop policy if exists "Admins read partner card tokens" on public.partner_card_tokens;
create policy "Admins read partner card tokens"
  on public.partner_card_tokens for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));

alter table public.qr_card_payments
  add column if not exists source text not null default 'user',
  add column if not exists partner_client_id text,
  add column if not exists partner_cardholder_ref text,
  add column if not exists partner_card_token_id uuid references public.partner_card_tokens(id) on delete set null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'qr_card_payments_source_check') then
    alter table public.qr_card_payments add constraint qr_card_payments_source_check check (source in ('user','partner'));
  end if;
end $$;

create index if not exists qr_card_payments_partner_idx
  on public.qr_card_payments(partner_client_id, created_at desc)
  where partner_client_id is not null;

alter table public.qr_card_payments alter column virtual_card_id drop not null;

create or replace view public.merchant_qr_directory as
select
  gm.id            as merchant_id,
  gm.business_name as name,
  gm.environment,
  gm.status,
  coalesce(gm.metadata->>'mcc', '') as mcc,
  coalesce(gm.metadata->>'country', 'CM') as country,
  coalesce(gm.metadata->>'logo_url', '') as logo_url,
  case when gm.kyb_status = 'approved' then true else false end as verified,
  gm.created_at
from public.gateway_merchants gm
where gm.status = 'active' and gm.kyb_status = 'approved';
grant select on public.merchant_qr_directory to anon, authenticated;

drop function if exists public.get_admin_qr_payments_audit();
drop view if exists public.admin_qr_payments_audit cascade;

create view public.admin_qr_payments_audit
with (security_invoker = true) as
select
  qcp.id                       as qr_payment_id,
  qcp.user_id, qcp.virtual_card_id, qcp.pisp_payment_id, qcp.qr_hash,
  qcp.merchant_key, qcp.merchant_name, qcp.merchant_id, qcp.merchant_external,
  qcp.merchant_country, qcp.merchant_category_code, qcp.amount, qcp.currency,
  qcp.status, qcp.failure_reason, qcp.cancelled_at, qcp.cancelled_by,
  qcp.idempotency_key, qcp.metadata,
  qcp.source, qcp.partner_client_id, qcp.partner_cardholder_ref, qcp.partner_card_token_id,
  qcp.created_at, qcp.updated_at,
  idem.request_hash,
  idem.response_status         as idempotency_response_status,
  idem.response_json           as idempotency_response_json,
  idem.expires_at              as idempotency_expires_at,
  idem.created_at              as idempotency_created_at
from public.qr_card_payments qcp
left join public.qr_payment_idempotency idem
  on idem.qr_card_payment_id = qcp.id
   or (idem.idempotency_key = qcp.idempotency_key and idem.user_id = qcp.user_id);

revoke all on public.admin_qr_payments_audit from public, anon, authenticated;
grant select on public.admin_qr_payments_audit to authenticated;

create or replace function public.get_admin_qr_payments_audit()
returns setof public.admin_qr_payments_audit
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'forbidden: admin role required';
  end if;
  return query select * from public.admin_qr_payments_audit;
end;
$$;
grant execute on function public.get_admin_qr_payments_audit() to authenticated;

create or replace function public.partner_card_tokens_set_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists partner_card_tokens_updated_at on public.partner_card_tokens;
create trigger partner_card_tokens_updated_at
  before update on public.partner_card_tokens
  for each row execute function public.partner_card_tokens_set_updated_at();
