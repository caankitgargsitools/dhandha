-- 67: learned format catalogue (1 Nov 2026).
-- Every tender reading (customer reads, automatic pre-checks, and a small daily "harvest" of tenders across industries)
-- hands its formats to /api/formats/learn (lib/formatHarvest.js cleans and fingerprints them) → format_learn: a format
-- seen before counts as a repeat, a new one becomes a catalogue entry. The assistant's picker suggests catalogue entries
-- for each format a tender names, filtered by industry. Only public tender text is stored, never a customer's answers.

-- harvest jobs belong to no customer
alter table public.tender_doc_jobs alter column tenant_id drop not null;
alter table public.tender_doc_jobs alter column company_id drop not null;
alter table public.tender_doc_jobs alter column match_id drop not null;
alter table public.tender_reads add column if not exists learned_at timestamptz;

create table if not exists public.format_catalog (
  id uuid primary key default gen_random_uuid(),
  heading text not null,
  title_key text not null,
  ident text,
  type text not null default 'custom',
  sectors text[] not null default '{}',
  exec text,
  body text not null,
  minhash int[] not null,
  quality int not null default 0,
  seen_count int not null default 1,
  used_count int not null default 0,
  sample_tenders uuid[] not null default '{}',
  portals text[] not null default '{}',
  authorities text[] not null default '{}',
  states text[] not null default '{}',
  headings text[] not null default '{}',
  status text not null default 'new' check (status in ('new', 'approved', 'hidden')),
  reviewed_by uuid, reviewed_at timestamptz,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists format_catalog_key on public.format_catalog (title_key);
create index if not exists format_catalog_type on public.format_catalog (type);
create index if not exists format_catalog_sectors on public.format_catalog using gin (sectors);
alter table public.format_catalog enable row level security;
create policy format_catalog_read on public.format_catalog for select to authenticated using (status <> 'hidden' or public.is_platform_admin());

create or replace function private.mh_sim(a int[], b int[]) returns numeric language sql immutable set search_path = '' as $$
  select coalesce(count(*) filter (where x = y)::numeric / nullif(least(cardinality(a), cardinality(b)), 0), 0) from unnest(a, b) as u(x, y);
$$;

create or replace function private.add_capped(arr text[], v text, cap int default 20) returns text[] language sql immutable set search_path = '' as $$
  select case when v is null or v = '' or v = any(arr) or cardinality(arr) >= cap then arr else arr || v end;
$$;

-- readings whose formats are not yet in the catalogue (worker key)
create or replace function public.format_learn_claim(p_key text, p_limit int default 20) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare out jsonb;
begin
  if not private.outreach_key_ok(p_key) then raise exception 'bad worker key'; end if;
  with c as (
    select r.id from public.tender_reads r where r.learned_at is null and jsonb_typeof(r.formats) = 'array' and jsonb_array_length(r.formats) > 0
    order by r.created_at limit least(greatest(p_limit, 1), 50) for update skip locked
  ), u as (update public.tender_reads r set learned_at = now() from c where r.id = c.id returning r.id, r.tender_id, r.formats)
  select coalesce(jsonb_agg(jsonb_build_object('read', u.id, 'formats', u.formats, 'tender', jsonb_build_object('id', t.id, 'title', t.title, 'authority', t.authority,
    'department', t.department, 'tender_ref', t.tender_ref, 'category', t.category, 'industry_pack', t.industry_pack, 'portal', t.portal, 'state', t.state))), '[]')
  into out from u join public.tenders t on t.id = u.tender_id;
  -- readings with no formats are simply marked
  update public.tender_reads set learned_at = now() where learned_at is null and (formats is null or jsonb_typeof(formats) <> 'array' or jsonb_array_length(formats) = 0);
  return out;
end $$;

-- store cleaned formats: a repeat raises the count, a new one is added (worker key)
create or replace function public.format_learn(p_key text, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare it jsonb; mh int[]; best uuid; best_sim numeric; v_new int := 0; v_rep int := 0; v_t uuid;
begin
  if not private.outreach_key_ok(p_key) then raise exception 'bad worker key'; end if;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]')) limit 400 loop
    if coalesce(length(it->>'body'), 0) < 100 or jsonb_typeof(it->'minhash') <> 'array' then continue; end if;
    mh := array(select (x)::int from jsonb_array_elements_text(it->'minhash') x limit 64);
    v_t := nullif(it->>'tender_id', '')::uuid;
    select c.id, private.mh_sim(c.minhash, mh) into best, best_sim from public.format_catalog c
    where c.title_key = it->>'title_key' or c.type = it->>'type'
    order by private.mh_sim(c.minhash, mh) desc limit 1;
    if best is not null and (best_sim >= 0.6 or (best_sim >= 0.35 and exists (select 1 from public.format_catalog c where c.id = best and c.title_key = it->>'title_key'))) then
      update public.format_catalog c set
        seen_count = seen_count + case when v_t is not null and v_t = any(sample_tenders) then 0 else 1 end,
        sample_tenders = case when v_t is null or v_t = any(sample_tenders) or cardinality(sample_tenders) >= 20 then sample_tenders else sample_tenders || v_t end,
        sectors = private.add_capped(sectors, it->>'sector', 12),
        portals = private.add_capped(portals, it->>'portal'),
        authorities = private.add_capped(authorities, left(it->>'authority', 120)),
        states = private.add_capped(states, it->>'state'),
        headings = private.add_capped(headings, left(it->>'heading', 140), 12),
        -- a cleaner copy of the same format replaces the wording
        body = case when coalesce((it->>'quality')::int, 0) >= quality + 15 then left(it->>'body', 12000) else body end,
        quality = greatest(quality, coalesce((it->>'quality')::int, 0)),
        exec = coalesce(exec, nullif(it->>'exec', '')),
        last_seen = now()
      where c.id = best;
      v_rep := v_rep + 1;
    else
      insert into public.format_catalog (heading, title_key, ident, type, sectors, exec, body, minhash, quality, sample_tenders, portals, authorities, states, headings)
      values (left(it->>'heading', 140), left(it->>'title_key', 120), left(it->>'ident', 40), coalesce(nullif(it->>'type', ''), 'custom'),
        case when coalesce(it->>'sector', '') = '' then '{}' else array[it->>'sector'] end, nullif(it->>'exec', ''), left(it->>'body', 12000), mh,
        coalesce((it->>'quality')::int, 0), case when v_t is null then '{}' else array[v_t] end,
        case when coalesce(it->>'portal', '') = '' then '{}' else array[it->>'portal'] end,
        case when coalesce(it->>'authority', '') = '' then '{}' else array[left(it->>'authority', 120)] end,
        case when coalesce(it->>'state', '') = '' then '{}' else array[it->>'state'] end, array[left(it->>'heading', 140)]);
      v_new := v_new + 1;
    end if;
  end loop;
  return jsonb_build_object('new', v_new, 'repeat', v_rep);
end $$;

-- the picker's list (light columns); bodies are read one by one
create or replace function public.format_catalog_index() returns table (id uuid, heading text, title_key text, type text, sectors text[], exec text, seen_count int, used_count int, status text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.heading, c.title_key, c.type, c.sectors, c.exec, c.seen_count, c.used_count, c.status from public.format_catalog c
  where auth.uid() is not null and c.status <> 'hidden' and (c.status = 'approved' or c.seen_count >= 1)
  order by c.seen_count desc limit 5000;
$$;

create or replace function public.format_catalog_used(p_ids uuid[]) returns void language sql security definer set search_path = '' as $$
  update public.format_catalog set used_count = used_count + 1 where auth.uid() is not null and id = any(p_ids[1:40]);
$$;

-- platform admin: approve / hide / edit an entry
create or replace function public.format_catalog_set(p_id uuid, p_status text default null, p_heading text default null, p_body text default null, p_sectors text[] default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'not allowed'; end if;
  if p_status is not null and p_status not in ('new', 'approved', 'hidden') then raise exception 'bad status'; end if;
  update public.format_catalog set status = coalesce(p_status, status), heading = coalesce(nullif(left(p_heading, 140), ''), heading),
    body = coalesce(nullif(left(p_body, 12000), ''), body), sectors = coalesce(p_sectors, sectors), reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_id;
end $$;

-- the harvest: a few tenders a run, spread across industries and authorities, fetched like a pre-check (claimed after
-- every customer job), read by the free reader, their formats learned, then their downloaded files dropped
insert into private.app_config (key, value) values ('format_harvest_per_run', '8') on conflict (key) do nothing;

create or replace function private.format_harvest_queue() returns int
language plpgsql security definer set search_path = '' as $$
declare n int := coalesce(nullif((select value from private.app_config where key = 'format_harvest_per_run'), '')::int, 8); open_now int; added int := 0; r record;
begin
  -- harvest jobs nobody got to in 6 hours are dropped
  update public.tender_doc_jobs set status = 'failed', error = 'Harvest not fetched in time', updated_at = now()
  where detail->>'purpose' = 'harvest' and status = 'queued' and created_at < now() - interval '6 hours';
  select count(*) into open_now from public.tender_doc_jobs where detail->>'purpose' = 'harvest' and status in ('queued', 'running', 'captcha');
  if n <= 0 or open_now >= n then return 0; end if;
  for r in
    select x.id from (
      select distinct on (coalesce(t.industry_pack, '-'), coalesce(t.category, '-'), t.authority) t.id, coalesce(t.industry_pack, '-') pack
      from public.tenders t
      where t.status = 'live' and t.due_at > now() + interval '2 days' and t.prechecked_at is null and t.authority is not null
        and t.portal not in ('SBI e-Procurement', 'IREPS', 'CPPP', 'HSVP e-Tender', 'Gujarat nProcure', 'Karnataka KPPP', 'AP eProcurement', 'Telangana eProcurement', 'Bihar eProc', 'NTPC Tenders', 'SAIL Tenders', 'World Bank')
        and t.portal not ilike '%gem%'
        and not exists (select 1 from public.tender_reads x where x.tender_id = t.id)
        and not exists (select 1 from public.tender_doc_jobs j where j.tender_id = t.id)
        -- organisations already in the catalogue are skipped, so each run brings new ones
        and not exists (select 1 from public.format_catalog c where t.authority = any(c.authorities))
      order by coalesce(t.industry_pack, '-'), coalesce(t.category, '-'), t.authority, random()
    ) x
    -- round-robin across industries: one of each pack before a second of any
    order by row_number() over (partition by x.pack order by random()), random()
    limit 50
  loop
    exit when added >= n - open_now;
    insert into public.tender_doc_jobs (tender_id, step, auto, detail, created_by) values (r.id, 'Fetching to learn its formats', true, '{"purpose":"harvest"}', null);
    added := added + 1;
  end loop;
  return added;
end $$;

create or replace function private.format_learn_kick() returns bigint language sql security definer set search_path = '' as $$
  select net.http_post(url := rtrim((select value from private.app_config where key = 'app_url'), '/') || '/api/formats/learn',
    body := '{}'::jsonb,
    headers := jsonb_build_object('content-type', 'application/json', 'x-worker-key', (select decrypted_secret from vault.decrypted_secrets where name = 'outreach_worker_key')),
    timeout_milliseconds := 60000);
$$;

-- after a pre-check: a harvest job's downloaded files are dropped (status collected) and the formats are learned
create or replace function public.precheck_report_harvest(p_key text, p_job uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.outreach_key_ok(p_key) then raise exception 'bad worker key'; end if;
  update public.tender_doc_jobs set status = 'collected', step = 'Formats added to the catalogue; files cleared', updated_at = now()
  where id = p_job and detail->>'purpose' = 'harvest' and status = 'fetched';
  if found then perform private.format_learn_kick(); end if;
end $$;

grant execute on function public.format_learn_claim(text, int), public.format_learn(text, jsonb), public.precheck_report_harvest(text, uuid) to anon, authenticated;
grant execute on function public.format_catalog_index(), public.format_catalog_used(uuid[]), public.format_catalog_set(uuid, text, text, text, text[]) to authenticated;

select cron.schedule('format_harvest', '7 5,10 * * *', 'select private.format_harvest_queue()');
select cron.schedule('format_learn', '29 * * * *', 'select private.format_learn_kick()');

-- platform admin: how many tenders a harvest run fetches (0 = off), run one now, and the numbers
create or replace function public.format_harvest_admin(p_per_run int default null, p_run_now boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_added int := 0;
begin
  if not public.is_platform_admin() then raise exception 'not allowed'; end if;
  if p_per_run is not null then
    insert into private.app_config (key, value) values ('format_harvest_per_run', greatest(0, least(p_per_run, 40))::text)
    on conflict (key) do update set value = excluded.value;
  end if;
  if p_run_now then v_added := private.format_harvest_queue(); end if;
  return jsonb_build_object('per_run', (select value from private.app_config where key = 'format_harvest_per_run'), 'queued_now', v_added,
    'open', (select count(*) from public.tender_doc_jobs where detail->>'purpose' = 'harvest' and status in ('queued', 'running', 'captcha')),
    'done', (select count(*) from public.tender_doc_jobs where detail->>'purpose' = 'harvest' and status = 'collected'),
    'failed', (select count(*) from public.tender_doc_jobs where detail->>'purpose' = 'harvest' and status = 'failed'),
    'entries', (select count(*) from public.format_catalog), 'new_week', (select count(*) from public.format_catalog where first_seen > now() - interval '7 days'),
    'reads_waiting', (select count(*) from public.tender_reads where learned_at is null));
end $$;
grant execute on function public.format_harvest_admin(int, boolean) to authenticated;
