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

-- Tender winners' captcha switched off for now (1 Nov): the results page rejected every typed answer, so each portal
-- asked the admin a third captcha for nothing. app_config session_winners = 'off'; set 'on' once the results form is fixed.
insert into private.app_config (key, value) values ('session_winners', 'off') on conflict (key) do update set value = 'off';
create or replace function private.skip_winners_captcha() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.state = 'captcha' and coalesce(new.step, '') ilike 'Tender winners%'
     and coalesce((select value from private.app_config where key = 'session_winners'), 'on') = 'off' then
    new.state := 'live';
    new.step := 'Live — tender winners skipped (switched off for now)';
    new.captcha_image := null;
  end if;
  return new;
end $$;
create trigger b_skip_winners_captcha before insert or update on public.portal_sessions for each row execute function private.skip_winners_captcha();

-- World Bank is not a captcha portal
create or replace function private.session_portals() returns setof text language sql stable security definer set search_path to '' as $function$
  select distinct portal from public.tenders where portal not in ('SBI e-Procurement', 'IREPS', 'CPPP', 'HSVP e-Tender', 'Gujarat nProcure', 'Karnataka KPPP', 'AP eProcurement', 'Telangana eProcurement', 'Bihar eProc', 'NTPC Tenders', 'SAIL Tenders', 'World Bank') and portal not ilike '%gem%' and status = 'live'
$function$;

-- learning_stats() for Admin → What Dhandha has learned (applied with execute_sql, 1 Nov): counts and growth of every
-- learning store (format_catalog, tender_texts, tender_reads, tender_matches decisions, win_stats, tender_awards, rivals,
-- voice_lessons, portal_session_log, master.* facts, taxonomy_custom, ai_usage, harvest jobs). See the database for the body.
