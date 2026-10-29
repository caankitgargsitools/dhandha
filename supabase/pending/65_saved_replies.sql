-- 65. Saved replies (C45, 29 Oct 2026; applied with apply_migration saved_replies). The team's ready answers, picked
-- with one tap in the WhatsApp inbox (lib/savedReplies.js fills {first_name} {name} {company} {my_name} {my_company}).
create table if not exists public.saved_replies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null check (length(title) between 1 and 80),
  shortcut text check (shortcut ~ '^[a-z0-9_-]{1,24}$'),
  body text not null check (length(body) between 1 and 4000),
  uses int not null default 0,
  archived boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.saved_replies enable row level security;
create policy saved_replies_read on public.saved_replies for select using (public.is_tenant_member(tenant_id));
-- saved_reply_save(tenant, id, title, body, shortcut, archived): writers only (null-safe role check), ≤200 live,
--   archive instead of delete; saved_reply_used(id) counts a use (members).
