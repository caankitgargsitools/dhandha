-- Tender study round 2 fixes (1 Nov 2026, night).
-- F51: 7 is tenders.req_similar_years' column default (the CPWD norm), not what a document said — a pre-check reading's own
-- figure now replaces it.
do $$
declare d text; o text := $o$req_similar_years = coalesce(req_similar_years, nullif(f->>'req_similar_years', '')::int),$o$;
begin
  d := pg_get_functiondef('public.precheck_report'::regproc::oid);
  if position(o in d) > 0 then
    d := replace(d, o, $n$req_similar_years = case when nullif(f->>'req_similar_years', '') is not null and coalesce(req_similar_years, 7) = 7 then (f->>'req_similar_years')::int else req_similar_years end,$n$);
    execute d;
  end if;
end $$;

-- F49: GeM reverse-auction notices (GEM/yyyy/R/…) are not new tenders — only bidders already qualified in the parent bid
-- may join — so they never fit a firm's matches; open ones nobody acted on are hidden (kept, not deleted).
do $$
declare d text; o text := $o$and (t.reserved_for is null or private.firm_named(t.reserved_for, p_company))$o$;
begin
  d := pg_get_functiondef('public.tender_fits'::regproc::oid);
  if position('GEM/[0-9]{4}/R/' in d) = 0 and position(o in d) > 0 then
    d := replace(d, o, o || $n$
       and coalesce(t.tender_ref, '') !~ '^GEM/[0-9]{4}/R/'$n$);
    execute d;
  end if;
end $$;
update public.tender_matches m set unfit = true, matched_on = '{}'
from public.tenders t
where t.id = m.tender_id and t.tender_ref ~ '^GEM/[0-9]{4}/R/' and not m.unfit and m.status = 'new';
