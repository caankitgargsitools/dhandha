-- Credentials learned from fetched tenders (owner, Q11, 1 Nov 2026): how many tenders ask for each credential, overall
-- or only those whose title matches an industry's words (p_rx, a POSIX regex built from SECTORS in
-- lib/formatHarvest.js). Read from the newest reading of each tender (tender_reads.fields -> credentials, written by the
-- free reader lib/credentials.js). Public tender data only, so any signed-in member may read the counts.
create or replace function public.credential_stats(p_rx text default null)
returns table (key text, tenders bigint)
language sql stable security definer set search_path = public as $$
  with latest as (
    select distinct on (r.tender_id) r.tender_id, r.fields
    from tender_reads r
    where r.fields ? 'credentials'
    order by r.tender_id, r.created_at desc
  )
  select c->>'key' as key, count(distinct l.tender_id) as tenders
  from latest l
  join tenders t on t.id = l.tender_id
  cross join lateral jsonb_array_elements(l.fields->'credentials') c
  where p_rx is null or t.title ~* p_rx
  group by 1
  order by 2 desc;
$$;
revoke all on function public.credential_stats(text) from public, anon;
grant execute on function public.credential_stats(text) to authenticated;
