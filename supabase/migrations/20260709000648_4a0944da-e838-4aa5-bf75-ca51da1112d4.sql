create extension if not exists vector;

create table if not exists public.kang_financial_knowledge (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.kang_financial_knowledge to authenticated;
grant all on public.kang_financial_knowledge to service_role;

alter table public.kang_financial_knowledge enable row level security;

drop policy if exists "Admins manage kang knowledge" on public.kang_financial_knowledge;
create policy "Admins manage kang knowledge"
  on public.kang_financial_knowledge
  for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "Authenticated read kang knowledge" on public.kang_financial_knowledge;
create policy "Authenticated read kang knowledge"
  on public.kang_financial_knowledge
  for select
  to authenticated
  using (true);

create index if not exists kang_knowledge_embedding_idx
  on public.kang_financial_knowledge
  using hnsw (embedding vector_cosine_ops);

create or replace function public.match_kang_knowledge(
  query_embedding vector(1536),
  match_count int default 3
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    k.id,
    k.content,
    k.metadata,
    1 - (k.embedding <=> query_embedding) as similarity
  from public.kang_financial_knowledge k
  where k.embedding is not null
  order by k.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_kang_knowledge(vector, int) to authenticated, service_role;