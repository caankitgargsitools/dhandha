-- 68: tender study (1 Nov 2026). The full public text of every pre-checked tender is kept (tender_texts) so the whole
-- body of tenders can be studied — conditions, evaluation and price methods, formats — across industries; GeM bid
-- documents (public PDFs, no captcha) are fetched in bulk outside market hours to widen the study.
create table if not exists public.tender_texts (
  tender_id uuid primary key references public.tenders(id),
  text text not null,
  pages int,
  chars int,
  studied_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.tender_texts enable row level security; -- no policies: only the worker functions and SQL read it

create or replace function public.tender_text_save(p_key text, p_tender uuid, p_text text, p_pages int default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.outreach_key_ok(p_key) then raise exception 'bad worker key'; end if;
  insert into public.tender_texts (tender_id, text, pages, chars) values (p_tender, left(p_text, 300000), p_pages, length(left(p_text, 300000)))
  on conflict (tender_id) do update set text = excluded.text, pages = excluded.pages, chars = excluded.chars;
end $$;

-- the tender's own link, for portals whose documents are a direct download (GeM) — document worker key
create or replace function public.doc_job_url(p_key text, p_job uuid) returns text
language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_ingest_key(p_key);
  return (select t.url from public.tender_doc_jobs j join public.tenders t on t.id = j.tender_id where j.id = p_job);
end $$;

-- GeM harvest: open GeM bids across departments and categories, a batch every 15 minutes outside market hours
insert into private.app_config (key, value) values ('gem_harvest_per_run', '15') on conflict (key) do nothing;
create or replace function private.gem_harvest_queue() returns int
language plpgsql security definer set search_path = '' as $$
declare n int := coalesce(nullif((select value from private.app_config where key = 'gem_harvest_per_run'), '')::int, 15); open_now int; added int := 0; r record;
begin
  update public.tender_doc_jobs set status = 'failed', error = 'Harvest not fetched in time', updated_at = now()
  where detail->>'purpose' = 'harvest' and status = 'queued' and created_at < now() - interval '6 hours';
  select count(*) into open_now from public.tender_doc_jobs j join public.tenders t on t.id = j.tender_id
  where j.detail->>'purpose' = 'harvest' and j.status in ('queued', 'running') and t.portal = 'GeM';
  if n <= 0 or open_now >= n then return 0; end if;
  for r in
    select x.id from (
      select distinct on (coalesce(t.category, '-'), t.authority) t.id, coalesce(t.industry_pack, '-') pack
      from public.tenders t
      where t.portal = 'GeM' and t.status = 'live' and t.due_at > now() + interval '1 day' and t.url ~ '^https://bidplus\.gem\.gov\.in/show'
        and not exists (select 1 from public.tender_texts x where x.tender_id = t.id)
        and not exists (select 1 from public.tender_doc_jobs j where j.tender_id = t.id)
      order by coalesce(t.category, '-'), t.authority, random()
    ) x
    order by row_number() over (partition by x.pack order by random()), random()
    limit 100
  loop
    exit when added >= n - open_now;
    insert into public.tender_doc_jobs (tender_id, step, auto, detail, created_by) values (r.id, 'Fetching to study it', true, '{"purpose":"harvest"}', null);
    added := added + 1;
  end loop;
  return added;
end $$;

grant execute on function public.tender_text_save(text, uuid, text, int), public.doc_job_url(text, uuid) to anon, authenticated;
-- every 15 minutes from 15:45 to 08:30 India time (10:15–03:00 UTC); nothing during market hours
select cron.schedule('gem_harvest', '*/15 10-23,0-2 * * *', 'select private.gem_harvest_queue()');
