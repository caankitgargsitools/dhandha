-- 87 (13 Nov): knowledge base (owner, map item 9) — the firm's own how-we-work notes in one searchable place: SOPs,
-- contract terms, policies, FAQs for clients, templates, lessons. Searched free; "Ask" answers from them with paid AI
-- only (private firm text; 2 credits). Archived, never deleted.
create table if not exists public.kb_articles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  company_id uuid not null references public.companies(id),
  kind text not null default 'sop' check (kind in ('sop','contract','policy','faq','template','lesson','other')),
  title text not null, body text not null default '', tags text,
  pinned boolean not null default false,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(),
  updated_by uuid, updated_at timestamptz not null default now(), archived_at timestamptz
);
create index if not exists kb_articles_company on public.kb_articles (company_id, updated_at desc);
alter table public.kb_articles enable row level security;
do $$ begin
  create policy kb_read on public.kb_articles for select using (public.is_tenant_member(tenant_id));
  create policy kb_add on public.kb_articles for insert with check (coalesce(public.tenant_role(tenant_id), '') in ('admin','manager','bid_preparer'));
  create policy kb_edit on public.kb_articles for update using (coalesce(public.tenant_role(tenant_id), '') in ('admin','manager','bid_preparer'));
exception when duplicate_object then null; end $$;
grant select, insert, update on public.kb_articles to authenticated;
insert into public.price_book (action_code, module_code, name, credits, unit, note)
values ('kb_ask', 'platform', 'Ask your knowledge base (AI answer from your own notes)', 2, 'question', 'Searching the notes is free')
on conflict (action_code) do nothing;
