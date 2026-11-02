-- 2 Nov 2026: the captcha page polls portal_sessions_view every few seconds; private.session_portals() counted
-- distinct portals over every tender (3 s under crawler load → 144 statement timeouts in 30 minutes). Now a loose
-- index scan along tenders (portal, tender_ref): 0.06 s, same result.
create or replace function private.session_portals()
 returns setof text language sql stable security definer set search_path to '' as $function$
  with recursive p as (
    select min(portal) as portal from public.tenders
    union all
    select (select min(t.portal) from public.tenders t where t.portal > p.portal) from p where p.portal is not null
  )
  select p.portal from p
  where p.portal is not null
    and p.portal not in ('SBI e-Procurement', 'IREPS', 'CPPP', 'HSVP e-Tender', 'Gujarat nProcure', 'Karnataka KPPP', 'AP eProcurement', 'Telangana eProcurement', 'Bihar eProc', 'NTPC Tenders', 'SAIL Tenders', 'World Bank')
    and p.portal not ilike '%gem%'
    and exists (select 1 from public.tenders t where t.portal = p.portal and t.status = 'live')
$function$;
-- Study harvests re-enabled 2 Nov 12:45 UTC after the database recovered (gem_harvest_per_run stays 10).
-- PostgREST's own schema-cache role was given statement_timeout 60s on 1 Nov (alter role authenticator) so a schema
-- reload under load does not loop.
