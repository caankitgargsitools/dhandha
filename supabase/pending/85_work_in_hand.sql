-- 85 (11 Nov): work in hand (owner, map item 7) — progress updates with site photos, crew and place for every won job
-- (a won tender, or a won deal the team tracks as a job). Photos sit in the private bucket work-photos
-- (<tenant>/<company>/<job>/<time>-<name>, ≤10 MB each). Updates are kept, never deleted (archived_at).
insert into storage.buckets (id, name, public, file_size_limit) values ('work-photos', 'work-photos', false, 10485760) on conflict (id) do nothing;
do $$ begin
  create policy "work-photos read members" on storage.objects for select using (bucket_id = 'work-photos' and public.is_tenant_member(((storage.foldername(name))[1])::uuid));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "work-photos write members" on storage.objects for insert with check (bucket_id = 'work-photos' and coalesce(public.tenant_role(((storage.foldername(name))[1])::uuid), '') in ('admin','manager','bid_preparer','telecaller','field'));
exception when duplicate_object then null; end $$;

alter table public.deals add column if not exists track_work boolean not null default false,
  add column if not exists work_start date, add column if not exists work_end date, add column if not exists completed_on date;

create table if not exists public.work_updates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  company_id uuid not null references public.companies(id),
  match_id uuid references public.tender_matches(id),
  deal_id uuid references public.deals(id),
  progress int check (progress between 0 and 100),
  note text,
  crew int check (crew >= 0),
  crew_names text,
  photos text[] not null default '{}',
  lat double precision, lng double precision,
  issue boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  check (match_id is not null or deal_id is not null)
);
create index if not exists work_updates_match on public.work_updates (match_id, created_at desc);
create index if not exists work_updates_deal on public.work_updates (deal_id, created_at desc);
create index if not exists work_updates_company on public.work_updates (company_id, created_at desc);
alter table public.work_updates enable row level security;
do $$ begin
  create policy work_updates_read on public.work_updates for select using (public.is_tenant_member(tenant_id));
  create policy work_updates_add on public.work_updates for insert with check (coalesce(public.tenant_role(tenant_id), '') in ('admin','manager','bid_preparer','telecaller','field') and created_by = auth.uid());
  create policy work_updates_archive on public.work_updates for update using (coalesce(public.tenant_role(tenant_id), '') in ('admin','manager') or created_by = auth.uid());
exception when duplicate_object then null; end $$;
grant select, insert, update on public.work_updates to authenticated;

-- an update marked as a problem pushes the workspace's admins and managers
create or replace function private.on_work_issue() returns trigger language plpgsql security definer set search_path = '' as $$
declare a record; job text;
begin
  if not new.issue then return new; end if;
  job := coalesce((select left(x.title, 60) from public.tender_matches m join public.tenders x on x.id = m.tender_id where m.id = new.match_id),
                  (select left(title, 60) from public.deals where id = new.deal_id), 'a job');
  for a in select user_id from public.tenant_members where tenant_id = new.tenant_id and role in ('admin', 'manager') and user_id <> coalesce(new.created_by, '00000000-0000-0000-0000-000000000000'::uuid) loop
    perform private.push_to(a.user_id, 'Problem on site', job || ': ' || left(coalesce(new.note, ''), 120), '/app/work', 'work:' || new.id);
  end loop;
  return new;
end $$;
do $$ begin
  create trigger t_work_issue after insert on public.work_updates for each row execute function private.on_work_issue();
exception when duplicate_object then null; end $$;
