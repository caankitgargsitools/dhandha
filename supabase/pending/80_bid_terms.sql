-- Study round 2, owner's Yes (2 Nov 2026).
-- Q14: invitation-only bids. tenders.invite_only = {kind: limited|single|enlisted, masked, names[], with}. A named seller
-- list fits only the firms on it; "only vendors enlisted with X" fits only firms whose Vault says they are enlisted
-- with X (fact reg.psu_vendor, from the tender-ready checklist); a masked list stays visible (chip on the tender page).
alter table public.tenders add column if not exists invite_only jsonb;

create or replace function private.firm_invited(p_invite jsonb, p_company uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when p_invite is null then true
    when p_invite->>'kind' = 'enlisted' then exists (
      select 1 from public.company_facts f where f.company_id = p_company and f.key in ('reg.psu_vendor', 'reg.bank_vendor')
        and lower(f.value) like '%' || lower(trim(p_invite->>'with')) || '%')
    when coalesce((p_invite->>'masked')::boolean, true) or jsonb_array_length(coalesce(p_invite->'names', '[]'::jsonb)) = 0 then true
    else exists (select 1 from jsonb_array_elements_text(p_invite->'names') nm where private.firm_named(nm, p_company))
  end;
$$;
revoke all on function private.firm_invited(jsonb, uuid) from public;

do $$
declare d text; o text := $o$and coalesce(t.tender_ref, '') !~ '^GEM/[0-9]{4}/R/'$o$;
begin
  d := pg_get_functiondef('public.tender_fits'::regproc::oid);
  if position('firm_invited' in d) = 0 and position(o in d) > 0 then
    execute replace(d, o, o || $n$
       and private.firm_invited(t.invite_only, p_company)$n$);
  end if;
end $$;

create or replace function public.tender_invite_set(p_key text, p_tender uuid, p_invite jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not private.outreach_key_ok(p_key) then raise exception 'bad worker key'; end if;
  if jsonb_typeof(p_invite) <> 'object' or length(p_invite::text) > 4000 then raise exception 'bad invite'; end if;
  update public.tenders set invite_only = p_invite where id = p_tender and invite_only is distinct from p_invite;
  update public.tender_matches m set unfit = true, matched_on = '{}'
    where m.tender_id = p_tender and not m.unfit and m.status = 'new' and not private.firm_invited(p_invite, m.company_id);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.tender_invite_set(text, uuid, jsonb) from public;
grant execute on function public.tender_invite_set(text, uuid, jsonb) to anon, authenticated;

-- Q33: a GeM reverse auction (GEM/…/R/…) for a bid a firm is preparing or has submitted (same buyer and title as its
-- GEM/…/B/… bid) → phone alert to that firm's admins / managers / bid preparers.
create or replace function private.ra_notice_alert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if new.tender_ref !~ '^GEM/[0-9]{4}/R/' then return new; end if;
  for r in select distinct m.tenant_id, m.id match_id, p.title
           from public.tenders p join public.tender_matches m on m.tender_id = p.id
           where p.portal = new.portal and p.tender_ref ~ '^GEM/[0-9]{4}/B/' and p.authority = new.authority
             and lower(regexp_replace(p.title, '\W', '', 'g')) = lower(regexp_replace(new.title, '\W', '', 'g'))
             and m.status in ('preparing', 'submitted') loop
    perform private.push_to(tm.user_id, 'Reverse auction announced',
      left(format('%s — reverse auction %s%s. Keep your floor price ready.', r.title, new.tender_ref,
        case when new.due_at is not null then ' closes ' || to_char(new.due_at at time zone 'Asia/Kolkata', 'DD Mon HH24:MI') else '' end), 280),
      '/app/tenders/' || r.match_id, 'ra:' || new.id)
    from public.tenant_members tm where tm.tenant_id = r.tenant_id and tm.role in ('admin', 'manager', 'bid_preparer');
  end loop;
  return new;
exception when others then return new; -- an alert must never block the crawl
end $$;
-- (first install only: the trigger is new)
create trigger t_ra_notice_alert after insert on public.tenders for each row execute function private.ra_notice_alert();
