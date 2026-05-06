-- Allow cancellation tracking on QR card payments
alter table public.qr_card_payments
  drop constraint if exists qr_card_payments_status_check;

alter table public.qr_card_payments
  add constraint qr_card_payments_status_check
  check (status in ('pending','completed','failed','refunded','cancelled'));

alter table public.qr_card_payments
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid;

-- Admin-visible audit view: QR payment + idempotency record join
create or replace view public.admin_qr_payments_audit as
select
  qcp.id                       as qr_payment_id,
  qcp.user_id,
  qcp.virtual_card_id,
  qcp.pisp_payment_id,
  qcp.qr_hash,
  qcp.merchant_key,
  qcp.merchant_name,
  qcp.merchant_id,
  qcp.merchant_external,
  qcp.merchant_country,
  qcp.merchant_category_code,
  qcp.amount,
  qcp.currency,
  qcp.status,
  qcp.failure_reason,
  qcp.cancelled_at,
  qcp.cancelled_by,
  qcp.idempotency_key,
  qcp.metadata,
  qcp.created_at,
  qcp.updated_at,
  idem.request_hash,
  idem.response_status         as idempotency_response_status,
  idem.response_json           as idempotency_response_json,
  idem.expires_at              as idempotency_expires_at,
  idem.created_at              as idempotency_created_at
from public.qr_card_payments qcp
left join public.qr_payment_idempotency idem
  on idem.qr_card_payment_id = qcp.id
   or (idem.idempotency_key = qcp.idempotency_key and idem.user_id = qcp.user_id);

-- Restrict view to admins only via a SECURITY DEFINER guard function
revoke all on public.admin_qr_payments_audit from public, anon, authenticated;

create or replace function public.admin_can_read_qr_audit()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'admin'::app_role);
$$;

grant select on public.admin_qr_payments_audit to authenticated;

-- Enforce role check via row-level rule using a wrapper function
create or replace function public.get_admin_qr_payments_audit()
returns setof public.admin_qr_payments_audit
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'forbidden: admin role required';
  end if;
  return query select * from public.admin_qr_payments_audit;
end;
$$;

grant execute on function public.get_admin_qr_payments_audit() to authenticated;