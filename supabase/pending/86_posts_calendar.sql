-- 86 (13 Nov): posts calendar & brand voice (owner, map item 8). Text posts planned per day and channel, written free
-- from templates or by AI (public business text only → free tier first; 1 credit only when a paid tier wrote it),
-- copied / shared by the person and marked posted. Nothing is posted automatically (no social APIs connected yet).
create table if not exists public.brand_voice (
  company_id uuid primary key references public.companies(id),
  tenant_id uuid not null references public.tenants(id),
  tone text not null default 'friendly' check (tone in ('friendly','professional','bold','warm','expert')),
  audience text, about text, say_words text, avoid_words text, hashtags text,
  languages text[] not null default '{en}', channels text[] not null default '{google,linkedin,facebook,whatsapp}',
  per_week int not null default 3 check (per_week between 1 and 7),
  updated_by uuid default auth.uid(), updated_at timestamptz not null default now()
);
alter table public.brand_voice enable row level security;
do $$ begin
  create policy brand_voice_read on public.brand_voice for select using (public.is_tenant_member(tenant_id));
  create policy brand_voice_write on public.brand_voice for insert with check (coalesce(public.tenant_role(tenant_id), '') in ('admin','manager'));
  create policy brand_voice_update on public.brand_voice for update using (coalesce(public.tenant_role(tenant_id), '') in ('admin','manager'));
exception when duplicate_object then null; end $$;
grant select, insert, update on public.brand_voice to authenticated;

create table if not exists public.content_posts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  company_id uuid not null references public.companies(id),
  post_on date not null,
  channel text not null default 'google' check (channel in ('google','linkedin','facebook','instagram','whatsapp','x')),
  theme text not null default 'tip',
  title text, body text not null default '', hashtags text,
  status text not null default 'draft' check (status in ('draft','ready','posted','skipped')),
  engine text, posted_at timestamptz, link text,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists content_posts_company_day on public.content_posts (company_id, post_on);
alter table public.content_posts enable row level security;
do $$ begin
  create policy content_posts_read on public.content_posts for select using (public.is_tenant_member(tenant_id));
  create policy content_posts_add on public.content_posts for insert with check (coalesce(public.tenant_role(tenant_id), '') in ('admin','manager'));
  create policy content_posts_edit on public.content_posts for update using (coalesce(public.tenant_role(tenant_id), '') in ('admin','manager'));
exception when duplicate_object then null; end $$;
grant select, insert, update on public.content_posts to authenticated;

insert into public.price_book (action_code, module_code, name, credits, unit, note)
values ('post_ai', 'platform', 'Write a social post with AI', 1, 'post', 'Free when the free AI tier writes it; templates are always free')
on conflict (action_code) do nothing;
