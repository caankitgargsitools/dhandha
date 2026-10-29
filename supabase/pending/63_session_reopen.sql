-- 63. "Start today's session" reopens sessions that went live on an earlier day (29 Oct 2026, applied with
-- apply_migration session_start_reopens_stale_live). The worker reads each portal's tender winners only when it opens
-- a session; portals that never ask for a captcha stayed "live" from 27 Oct and were skipped by the start button, so
-- no winners were read on 28 / 29 Oct.
create or replace function private.session_stale(s public.portal_sessions) returns boolean language sql stable set search_path = '' as $$
  select coalesce(s.state, 'idle') <> 'live' or s.live_since is null
    or s.live_since < ((now() at time zone 'Asia/Kolkata')::date)::timestamp at time zone 'Asia/Kolkata';
$$;
-- captcha_session_start: the "all portals" case now requests every portal where private.session_stale(...) (was: state <> 'live').
-- private.session_daily_reminder: counts stale portals the same way; the push mentions that tender winners are read then.
