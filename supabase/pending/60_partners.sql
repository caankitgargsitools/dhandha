create table if not exists public.partner_profiles (
  company_id uuid primary key references public.companies(id),
  tenant_id uuid not null references public.tenants(id),
  open boolean not null default false,
  consortium boolean not null default true,
  sub_take boolean not null default true,
  sub_give boolean not null default true,
  states text[] not null default '{}',
  blurb text check (length(blurb) <= 500),
  updated_at timestamptz not null default now()
);
alter table public.partner_profiles enable row level security;
create policy "partner profiles: members read own" on public.partner_profiles for select to authenticated using (public.is_tenant_member(tenant_id));

create table if not exists public.subwork_posts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  company_id uuid not null references public.companies(id),
  title text not null check (length(title) between 5 and 160),
  details text check (length(details) <= 2000),
  industry_pack text,
  state text, city text,
  value_inr numeric(14,2) check (value_inr >= 0),
  closes_on date,
  status text not null default 'open' check (status in ('open','closed')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists subwork_open on public.subwork_posts(status, created_at desc);
alter table public.subwork_posts enable row level security;
create policy "subwork: members read own" on public.subwork_posts for select to authenticated using (public.is_tenant_member(tenant_id));

create table if not exists public.partner_requests (
  id uuid primary key default gen_random_uuid(),
  from_company uuid not null references public.companies(id),
  from_tenant uuid not null references public.tenants(id),
  to_company uuid not null references public.companies(id),
  to_tenant uuid not null references public.tenants(id),
  kind text not null check (kind in ('consortium','subcontract','subwork_interest')),
  tender_id uuid references public.tenders(id),
  subwork_id uuid references public.subwork_posts(id),
  message text check (length(message) <= 1000),
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create index if not exists partner_requests_to on public.partner_requests(to_company, created_at desc);
create index if not exists partner_requests_from on public.partner_requests(from_company, created_at desc);
alter table public.partner_requests enable row level security;
create policy "partner requests: either side reads" on public.partner_requests for select to authenticated using (public.is_tenant_member(from_tenant) or public.is_tenant_member(to_tenant));

-- a turnover band, never the exact figure
create or replace function private.turnover_band(p_company uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case when v is null then null when v < 1e7 then 'under ₹1 Cr' when v < 5e7 then '₹1–5 Cr' when v < 2.5e8 then '₹5–25 Cr' when v < 1e9 then '₹25–100 Cr' else '₹100 Cr+' end
  from (select max(nullif(regexp_replace(value, '[^0-9.]', '', 'g'), '')::numeric) v from public.company_facts where company_id = p_company and key = 'fin.turnover') q
$$;

create or replace function public.partner_profile_save(p_company uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_tenant uuid;
begin
  select tenant_id into v_tenant from companies where id = p_company;
  if v_tenant is null or coalesce(public.tenant_role(v_tenant), '') not in ('admin','manager') then raise exception 'Only admins and managers can change this'; end if;
  insert into partner_profiles (company_id, tenant_id, open, consortium, sub_take, sub_give, states, blurb)
  values (p_company, v_tenant, coalesce((p->>'open')::boolean, false), coalesce((p->>'consortium')::boolean, true), coalesce((p->>'sub_take')::boolean, true), coalesce((p->>'sub_give')::boolean, true),
    coalesce((select array_agg(distinct trim(x)) from jsonb_array_elements_text(coalesce(p->'states','[]')) x where trim(x) <> ''), '{}'), left(p->>'blurb', 500))
  on conflict (company_id) do update set open = excluded.open, consortium = excluded.consortium, sub_take = excluded.sub_take, sub_give = excluded.sub_give,
    states = excluded.states, blurb = excluded.blurb, updated_at = now();
end $$;

-- open partners for a tender (or a kind of work and state): only what they chose to share — no contacts until a request is accepted
create or replace function public.partner_candidates(p_company uuid, p_pack text, p_state text, p_kind text default 'consortium')
returns table(company_id uuid, name text, city text, state text, turnover_band text, years int, works int, blurb text, services int)
language plpgsql stable security definer set search_path = public as $$
declare v_tenant uuid;
begin
  select tenant_id into v_tenant from companies where id = p_company;
  if v_tenant is null or not public.is_tenant_member(v_tenant) then raise exception 'not allowed'; end if;
  return query
  select c.id, coalesce(nullif(c.trade_name,''), c.legal_name), c.city, c.state, private.turnover_band(c.id),
    case when c.incorporation_date is null then null else extract(year from age(c.incorporation_date))::int end,
    (select count(*)::int from experience_items e where e.company_id = c.id and e.status = 'completed'),
    pp.blurb, coalesce(cardinality(tp.services), 0)
  from partner_profiles pp join companies c on c.id = pp.company_id
  left join tender_preferences tp on tp.company_id = c.id
  where pp.open and c.tenant_id <> v_tenant
    and case p_kind when 'subcontract' then pp.sub_take else pp.consortium end
    and (coalesce(p_pack, '') = '' or p_pack = any(coalesce(tp.allowed_packs, tp.packs, '{}')))
    and (coalesce(p_state, '') = '' or cardinality(pp.states) = 0 or p_state = any(pp.states) or c.state = p_state)
  order by (c.state = p_state) desc nulls last, (select max(nullif(regexp_replace(value, '[^0-9.]', '', 'g'), '')::numeric) from company_facts f where f.company_id = c.id and f.key = 'fin.turnover') desc nulls last
  limit 30;
end $$;

create or replace function public.partner_request_send(p_from uuid, p_to uuid, p_kind text, p_tender uuid default null, p_subwork uuid default null, p_message text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_ft uuid; v_tt uuid; v_id uuid; u uuid; v_name text; v_title text;
begin
  select tenant_id, coalesce(nullif(trade_name,''), legal_name) into v_ft, v_name from companies where id = p_from;
  if v_ft is null or coalesce(public.tenant_role(v_ft), '') not in ('admin','manager','bid_preparer') then raise exception 'not allowed'; end if;
  if p_kind not in ('consortium','subcontract','subwork_interest') then raise exception 'bad kind'; end if;
  if p_kind = 'subwork_interest' then
    select company_id into p_to from subwork_posts where id = p_subwork and status = 'open';
    if p_to is null then raise exception 'This sub-work is closed'; end if;
  elsif not exists (select 1 from partner_profiles where company_id = p_to and open) then raise exception 'This firm is not taking partner requests';
  end if;
  select tenant_id into v_tt from companies where id = p_to;
  if v_tt = v_ft then raise exception 'That is your own workspace'; end if;
  if (select count(*) from partner_requests where from_tenant = v_ft and created_at > now() - interval '1 day') >= 20 then raise exception 'At most 20 partner requests a day'; end if;
  if exists (select 1 from partner_requests where from_company = p_from and to_company = p_to and status = 'pending' and coalesce(tender_id::text,'') = coalesce(p_tender::text,'') and coalesce(subwork_id::text,'') = coalesce(p_subwork::text,'')) then raise exception 'You already asked — waiting for their answer'; end if;
  insert into partner_requests (from_company, from_tenant, to_company, to_tenant, kind, tender_id, subwork_id, message, created_by)
  values (p_from, v_ft, p_to, v_tt, p_kind, p_tender, p_subwork, left(p_message, 1000), auth.uid()) returning id into v_id;
  v_title := coalesce((select title from tenders where id = p_tender), (select title from subwork_posts where id = p_subwork));
  for u in select user_id from tenant_members where tenant_id = v_tt and role in ('admin','manager') loop
    perform private.push_to(u, case p_kind when 'consortium' then 'Partner request (consortium / JV)' when 'subcontract' then 'Sub-contract offer' else 'Interest in your sub-work' end,
      v_name || coalesce(' · ' || left(v_title, 80), ''), '/app/tenders/partners?tab=requests', 'partner:' || v_id);
  end loop;
  return v_id;
end $$;

create or replace function public.partner_request_answer(p_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare r partner_requests; u uuid; v_name text;
begin
  select * into r from partner_requests where id = p_id and status = 'pending';
  if not found then raise exception 'Request not found or already answered'; end if;
  if coalesce(public.tenant_role(r.to_tenant), '') not in ('admin','manager') then raise exception 'Only admins and managers answer partner requests'; end if;
  update partner_requests set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now() where id = p_id;
  select coalesce(nullif(trade_name,''), legal_name) into v_name from companies where id = r.to_company;
  for u in select user_id from tenant_members where tenant_id = r.from_tenant and role in ('admin','manager','bid_preparer') loop
    perform private.push_to(u, case when p_accept then 'Partner request accepted' else 'Partner request declined' end, v_name || case when p_accept then ' — contact details are now on Partners' else '' end, '/app/tenders/partners?tab=requests', 'partner-ans:' || p_id);
  end loop;
end $$;

-- both directions; contact details only once accepted
create or replace function public.partner_inbox(p_company uuid)
returns table(id uuid, direction text, kind text, status text, other_name text, other_city text, tender_title text, subwork_title text, message text, created_at timestamptz, contact_person text, phone text, email text)
language plpgsql stable security definer set search_path = public as $$
declare v_tenant uuid;
begin
  select tenant_id into v_tenant from companies where id = p_company;
  if v_tenant is null or not public.is_tenant_member(v_tenant) then raise exception 'not allowed'; end if;
  return query
  select r.id, case when r.to_company = p_company then 'in' else 'out' end, r.kind, r.status,
    coalesce(nullif(o.trade_name,''), o.legal_name), o.city, t.title, s.title, r.message, r.created_at,
    case when r.status = 'accepted' then o.signatory_name end, case when r.status = 'accepted' then coalesce(o.phone, o.signatory_mobile) end, case when r.status = 'accepted' then o.email end
  from partner_requests r
  join companies o on o.id = case when r.to_company = p_company then r.from_company else r.to_company end
  left join tenders t on t.id = r.tender_id
  left join subwork_posts s on s.id = r.subwork_id
  where r.to_company = p_company or r.from_company = p_company
  order by r.created_at desc limit 100;
end $$;

create or replace function public.subwork_save(p_company uuid, p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_id uuid := nullif(p->>'id','')::uuid;
begin
  select tenant_id into v_tenant from companies where id = p_company;
  if v_tenant is null or coalesce(public.tenant_role(v_tenant), '') not in ('admin','manager','bid_preparer') then raise exception 'not allowed'; end if;
  if v_id is null then
    if (select count(*) from subwork_posts where company_id = p_company and status = 'open') >= 20 then raise exception 'At most 20 open sub-work posts'; end if;
    insert into subwork_posts (tenant_id, company_id, title, details, industry_pack, state, city, value_inr, closes_on, created_by)
    values (v_tenant, p_company, left(trim(p->>'title'),160), left(p->>'details',2000), nullif(p->>'industry_pack',''), nullif(p->>'state',''), nullif(p->>'city',''),
      nullif(p->>'value_inr','')::numeric, nullif(p->>'closes_on','')::date, auth.uid()) returning id into v_id;
  else
    update subwork_posts set status = coalesce(nullif(p->>'status',''), status) where id = v_id and company_id = p_company;
  end if;
  return v_id;
end $$;

-- open sub-work from other firms, in the kinds of work and states this company takes
create or replace function public.subwork_feed(p_company uuid)
returns table(id uuid, title text, details text, industry_pack text, state text, city text, value_inr numeric, closes_on date, created_at timestamptz, poster text, interested boolean)
language plpgsql stable security definer set search_path = public as $$
declare v_tenant uuid; v_packs text[]; v_states text[];
begin
  select tenant_id into v_tenant from companies where id = p_company;
  if v_tenant is null or not public.is_tenant_member(v_tenant) then raise exception 'not allowed'; end if;
  select coalesce(tp.allowed_packs, tp.packs), tp.states into v_packs, v_states from tender_preferences tp where tp.company_id = p_company;
  return query
  select s.id, s.title, s.details, s.industry_pack, s.state, s.city, s.value_inr, s.closes_on, s.created_at, coalesce(nullif(c.trade_name,''), c.legal_name),
    exists (select 1 from partner_requests r where r.subwork_id = s.id and r.from_company = p_company)
  from subwork_posts s join companies c on c.id = s.company_id
  where s.status = 'open' and s.tenant_id <> v_tenant and (s.closes_on is null or s.closes_on >= current_date)
    and (coalesce(cardinality(v_packs), 0) = 0 or s.industry_pack is null or s.industry_pack = any(v_packs))
    and (coalesce(cardinality(v_states), 0) = 0 or s.state is null or s.state = any(v_states))
  order by s.created_at desc limit 50;
end $$;

revoke all on function public.partner_profile_save(uuid,jsonb), public.partner_candidates(uuid,text,text,text), public.partner_request_send(uuid,uuid,text,uuid,uuid,text),
  public.partner_request_answer(uuid,boolean), public.partner_inbox(uuid), public.subwork_save(uuid,jsonb), public.subwork_feed(uuid) from public, anon;
grant execute on function public.partner_profile_save(uuid,jsonb), public.partner_candidates(uuid,text,text,text), public.partner_request_send(uuid,uuid,text,uuid,uuid,text),
  public.partner_request_answer(uuid,boolean), public.partner_inbox(uuid), public.subwork_save(uuid,jsonb), public.subwork_feed(uuid) to authenticated;
