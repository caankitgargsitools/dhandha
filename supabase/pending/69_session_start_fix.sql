-- 69 (1 Nov 2026): "Start today's session" failed with "missing FROM-clause entry for table public" — the stale-session
-- test passed the conflicting row as private.session_stale(public.portal_sessions). The test is now written inline on
-- the row's alias (applied with execute_sql).
create or replace function public.captcha_session_start(p_portals text[] default null::text[]) returns integer
language plpgsql security definer set search_path to '' as $function$
declare n int;
begin
  if not public.is_platform_admin() then raise exception 'not allowed'; end if;
  insert into public.portal_sessions as ps (portal, state, requested_at, requested_by, step, error, updated_at)
  select x, 'requested', now(), auth.uid(), 'Waiting for the documents worker', null, now()
  from (select private.session_portals() x) q where p_portals is null or x = any(p_portals)
  on conflict (portal) do update set state = 'requested', requested_at = now(), requested_by = auth.uid(), step = 'Waiting for the documents worker', error = null, updated_at = now()
  where ps.state not in ('opening', 'captcha')
    and (p_portals is not null or coalesce(ps.state, 'idle') <> 'live' or ps.live_since is null
         or ps.live_since < ((now() at time zone 'Asia/Kolkata')::date)::timestamp at time zone 'Asia/Kolkata');
  get diagnostics n = row_count;
  return n;
end $function$;

-- The captcha session page lists only the portals in the session (old sample portal names "CPPP" / "HSVP e-Tender"
-- from demo tenders no longer show through leftover portal_sessions rows). "CPPP Central e-Tenders" is the real one.
create or replace function public.portal_sessions_view()
 returns table(portal text, state text, step text, captcha_image text, captcha_seq integer, live_since timestamp with time zone, last_ok_at timestamp with time zone, served integer, error text, learned jsonb, renew_by timestamp with time zone, updated_at timestamp with time zone)
 language sql stable security definer set search_path to '' as $function$
  select p.portal, coalesce(s.state, 'idle'), s.step, case when s.state = 'captcha' then s.captcha_image end, coalesce(s.captcha_seq, 0),
    s.live_since, s.last_ok_at, coalesce(s.served, 0), s.error, l.j,
    case when s.state = 'live' and (l.j->>'median_min') is not null then s.live_since + make_interval(mins => ((l.j->>'median_min')::numeric * 0.85)::int) end,
    s.updated_at
  from (select private.session_portals() portal) p
  left join public.portal_sessions s on s.portal = p.portal
  cross join lateral (select private.session_learned(p.portal) j) l
  where public.is_platform_admin()
  order by p.portal
$function$;
