-- GeM bids reserved for one named vendor ("reserved only for M/s …") are hidden from every firm except the one named
-- (owner, Q12 "Yes, hide", 1 Nov 2026). The pre-check reads the name (lib/gemFields.js reserved_for) and reports it;
-- tender_fits refuses the tender for other firms, so a later re-score never brings it back.
alter table public.tenders add column if not exists reserved_for text;

create or replace function private.firm_named(p_vendor text, p_company uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.companies c, lateral unnest(array[c.legal_name, c.trade_name]) nm
    where c.id = p_company and length(public.norm_firm(nm)) >= 4
      and (public.norm_firm(p_vendor) like '%' || public.norm_firm(nm) || '%' or public.norm_firm(nm) like '%' || public.norm_firm(p_vendor) || '%'));
$$;

create or replace function public.tender_fits(p_tender uuid, p_company uuid)
 returns boolean language sql stable security definer set search_path to '' as $function$
  -- with services chosen, a tender fits only on its words (the portal's category alone is not enough); an unmistakable
  -- ("strong") phrase also overrides the crawler's guess of the work type; a bid reserved for another named vendor never fits
  select coalesce((
    select (cardinality(w.words) > 0
            or (jsonb_array_length(coalesce(p.rules, '[]')) = 0 and cardinality(coalesce(p.keywords, '{}')) = 0 and t.industry_pack = any(p.packs)))
       and not exists (select 1 from unnest(p.exclude_keywords) k where t.title ~* public.kw_rx(k))
       and (cardinality(p.allowed_packs) = 0 or t.industry_pack is null or t.industry_pack = any(p.allowed_packs) or 'any' = any(p.allowed_packs)
            or exists (select 1 from jsonb_array_elements(coalesce(p.rules, '[]')) r where coalesce((r->>'strong')::boolean, false) and r->>'k' = any(w.words)))
       and (t.reserved_for is null or private.firm_named(t.reserved_for, p_company))
    from public.tenders t, public.tender_preferences p, lateral (select public.tender_match_words(p_tender, p_company) words) w
    where t.id = p_tender and p.company_id = p_company), false);
$function$;

-- worker key (pre-check route): note the reserved vendor and hide open matches of every other firm at once
create or replace function public.tender_reserved_set(p_key text, p_tender uuid, p_vendor text)
returns integer language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not private.outreach_key_ok(p_key) then raise exception 'bad worker key'; end if;
  update public.tenders set reserved_for = left(p_vendor, 200) where id = p_tender and reserved_for is distinct from left(p_vendor, 200);
  update public.tender_matches m set unfit = true, matched_on = '{}'
    where m.tender_id = p_tender and not m.unfit and m.status = 'new' and not private.firm_named(p_vendor, m.company_id);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.tender_reserved_set(text, uuid, text) from public;
grant execute on function public.tender_reserved_set(text, uuid, text) to anon, authenticated;
revoke all on function private.firm_named(text, uuid) from public;
