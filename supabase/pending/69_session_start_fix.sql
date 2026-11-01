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
