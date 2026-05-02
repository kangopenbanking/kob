create table public.developer_portal_health (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  status int not null,
  ok boolean not null,
  content_check text not null,
  response_ms int not null,
  checked_at timestamptz not null default now()
);

create index developer_portal_health_checked_at_idx
  on public.developer_portal_health (checked_at desc);

alter table public.developer_portal_health enable row level security;

create policy "Admins can view portal health"
  on public.developer_portal_health
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));