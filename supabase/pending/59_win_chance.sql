create table if not exists public.win_stats (
  id bigint generated always as identity primary key,
  company_id uuid references public.companies(id),
  tenant_id uuid references public.tenants(id),
  feature text not null,
  value text not null,
  won int not null default 0,
  lost int not null default 0,
  updated_at timestamptz not null default now()
);
create unique index if not exists win_stats_key on public.win_stats (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), feature, value);
alter table public.win_stats enable row level security;
create policy "win stats: own company or global" on public.win_stats for select to authenticated
  using (company_id is null or public.is_tenant_member(tenant_id));

create or replace function private.lead_features(l public.leads)
returns table(feature text, value text, global boolean) language sql immutable set search_path = '' as $$
  select * from (values
    ('source', coalesce(l.source, 'none'), true),
    ('fit', case when coalesce(l.score,0) >= 80 then '80+' when l.score >= 60 then '60-79' when l.score >= 40 then '40-59' else '0-39' end, true),
    ('email', (coalesce(l.email,'') <> '')::text, true),
    ('phone', (coalesce(l.phone,'') <> '')::text, true),
    ('website', (coalesce(l.website,'') <> '')::text, true),
    ('person', (coalesce(l.contact_person,'') <> '')::text, true),
    ('whatsapp', coalesce(l.wa_opt_in, false)::text, true),
    ('referred', (l.referred_by is not null)::text, true),
    ('industry', lower(trim(l.industry)), false),
    ('state', lower(trim(l.state)), false),
    ('city', lower(trim(l.city)), false)
  ) f(feature, value, global) where value is not null and value <> ''
$$;

create or replace function private.win_stats_rebuild()
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.win_stats set won = 0, lost = 0, updated_at = now();
  with closed as (
    select l.id, l.company_id, l.tenant_id,
           bool_or(d.stage = 'won') as is_won,
           exists (select 1 from public.demo_seed s where s.table_name = 'leads' and s.row_id = l.id::text) as demo
    from public.leads l join public.deals d on d.lead_id = l.id
    where d.stage in ('won','lost')
    group by l.id
  ), f as (
    select c.company_id, c.tenant_id, x.feature, x.value, x.global, c.is_won, c.demo
    from closed c join public.leads l on l.id = c.id cross join lateral private.lead_features(l) x
  ), agg as (
    select company_id, tenant_id, feature, value, count(*) filter (where is_won)::int w, count(*) filter (where not is_won)::int lo from f group by 1,2,3,4
    union all
    select null::uuid, null::uuid, feature, value, count(*) filter (where is_won)::int, count(*) filter (where not is_won)::int from f where global and not demo group by 3,4 having count(distinct tenant_id) >= 3
    union all
    select company_id, tenant_id, '_all', '_all', count(*) filter (where is_won)::int, count(*) filter (where not is_won)::int from closed group by 1,2
    union all
    select null::uuid, null::uuid, '_all', '_all', count(*) filter (where is_won)::int, count(*) filter (where not is_won)::int from closed where not demo having count(distinct tenant_id) >= 3
  )
  insert into public.win_stats (company_id, tenant_id, feature, value, won, lost)
  select company_id, tenant_id, feature, value, w, lo from agg
  on conflict (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), feature, value) do update set won = excluded.won, lost = excluded.lost, updated_at = now();
  get diagnostics n = row_count;
  return n;
end $$;
select private.win_stats_rebuild();
select cron.schedule('win_stats_daily', '37 21 * * *', 'select private.win_stats_rebuild()');
