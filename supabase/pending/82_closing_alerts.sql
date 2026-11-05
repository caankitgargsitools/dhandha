-- 82 (5 Nov 2026): deadline cockpit alerts (brief §3.1). Applied with execute_sql.
create table if not exists private.closing_alerts_sent (match_id uuid not null, mark int not null, sent_at timestamptz not null default now(), primary key (match_id, mark));

-- bids shortlisted / preparing (not yet filed) closing within 72, 24 and 6 hours: one phone alert each to admins,
-- managers and bid preparers (each mark once per match)
create or replace function private.closing_alerts() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; u uuid; n int := 0; mk int;
begin
  for r in
    select m.id, m.tenant_id, m.status, t.title, t.due_at, extract(epoch from (t.due_at - now())) / 3600 as hrs
    from public.tender_matches m join public.tenders t on t.id = m.tender_id
    where m.status in ('shortlisted', 'preparing') and t.due_at > now() and t.due_at < now() + interval '73 hours'
  loop
    mk := case when r.hrs <= 6 then 6 when r.hrs <= 24 then 24 else 72 end;
    if exists (select 1 from private.closing_alerts_sent s where s.match_id = r.id and s.mark <= mk) then continue; end if;
    insert into private.closing_alerts_sent (match_id, mark) values (r.id, mk) on conflict do nothing;
    for u in select user_id from public.tenant_members where tenant_id = r.tenant_id and role in ('admin', 'manager', 'bid_preparer') loop
      perform private.push_to(u, case mk when 6 then 'Closing in 6 hours' when 24 then 'Closing tomorrow' else 'Closing in 3 days' end,
        left(r.title, 90) || ' — not filed yet. ' || to_char(r.due_at at time zone 'Asia/Kolkata', 'DD Mon HH24:MI') || ' IST.',
        '/app/tenders/' || r.id, 'closing:' || r.id || ':' || mk);
    end loop;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function private.closing_alerts() from public, anon, authenticated;
select cron.schedule('closing_alerts', '*/30 * * * *', 'select private.closing_alerts()');
