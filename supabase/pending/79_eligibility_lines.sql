-- 2 Nov 2026: eligibility sentences no rule understands yet, for Admin → Eligibility to learn (platform admins only).
create or replace function public.eligibility_lines(p_limit int default 400)
returns table (line text, tenders bigint, example text)
language sql stable security definer set search_path = '' as $$
  with l as (
    select r.tender_id, x.line from public.tender_reads r
    cross join lateral jsonb_array_elements_text(coalesce(case when jsonb_typeof(r.fields->'elig_open') = 'array' then r.fields->'elig_open' end, '[]'::jsonb)
      || coalesce(case when jsonb_typeof(r.fields->'other_eligibility') = 'array' then r.fields->'other_eligibility' end, '[]'::jsonb)) x(line)
    union all
    select t.id, c->>'quote' from public.tenders t cross join lateral jsonb_array_elements(case when jsonb_typeof(t.conditions) = 'array' then t.conditions else '[]'::jsonb end) c
    where c->>'key' like 'cond.%' and coalesce(c->>'quote', '') <> ''
  ), g as (
    select left(regexp_replace(lower(line), '[^a-z0-9]+', ' ', 'g'), 140) k, min(line) line, count(distinct tender_id) n, min(tender_id::text) tid
    from l where length(line) between 20 and 400 group by 1
  )
  select g.line, g.n, (select t.title from public.tenders t where t.id::text = g.tid)
  from g where public.is_platform_admin() order by g.n desc limit greatest(1, least(p_limit, 2000));
$$;
revoke all on function public.eligibility_lines(int) from public, anon;
grant execute on function public.eligibility_lines(int) to authenticated;
