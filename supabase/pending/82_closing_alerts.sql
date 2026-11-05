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

-- §3.2 File it (5 Nov): upload ticks, bid id / receipt and filing time on the match
alter table public.tender_matches add column if not exists submitted_at timestamptz, add column if not exists submission_ref text,
  add column if not exists upload_ticks jsonb not null default '{}'::jsonb;

-- §3.3 results fill themselves (5 Nov): ingest_awards (edited in place) — an own win also sets result_stage 'awarded',
-- result_at and L1 = the awarded value; a *submitted* bid whose award went to another firm becomes lost
-- (result_reason "Awarded to X (from the portal's result)", L1 price), the EMD refund falls due (t_deposit_on_result)
-- and admins / managers / bid preparers get "Result: not won"; in a split order an own award row later turns such an
-- automatic "lost" back into won.
-- §3.4 after the award: LoA / work order, contract value, work dates, completion → Experience
alter table public.tender_matches add column if not exists loa_no text, add column if not exists loa_date date, add column if not exists contract_value numeric,
  add column if not exists work_start date, add column if not exists work_end date, add column if not exists completed_on date, add column if not exists experience_id uuid;

-- §3.7 why a tender was skipped (5 Nov)
alter table public.tender_matches add column if not exists skip_reason text;

-- §3.9 team notes per tender with phone alerts to the people ticked
create table if not exists public.tender_comments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  company_id uuid not null references public.companies(id),
  match_id uuid not null references public.tender_matches(id),
  body text not null check (length(body) between 1 and 2000),
  mentions uuid[] not null default '{}',
  author uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists tender_comments_match on public.tender_comments (match_id, created_at);
alter table public.tender_comments enable row level security;
create policy tc_read on public.tender_comments for select using (public.is_tenant_member(tenant_id));
create policy tc_insert on public.tender_comments for insert with check (public.is_tenant_member(tenant_id) and author = auth.uid()
  and coalesce(public.tenant_role(tenant_id), '') not in ('viewer', 'disabled')
  and exists (select 1 from public.tender_matches m where m.id = match_id and m.company_id = tender_comments.company_id and m.tenant_id = tender_comments.tenant_id));
create policy tc_archive on public.tender_comments for update using (author = auth.uid()) with check (author = auth.uid());
-- private.tender_comment_push() + trigger t_tender_comment_push: "X mentioned you" to each ticked member (not the author)

-- §3.5 corrigendum re-read (5 Nov; both edited in place with pg_get_functiondef + replace):
--   private.on_tender_change: a change on a shortlisted / preparing / submitted bid on a fetchable portal queues an auto
--   tender_doc_jobs row (detail {"purpose":"corrigendum","field":…}), at most once in 6 hours per tender
--   public.precheck_claim: also claims fetched corrigendum jobs although the tender was read before, so the free reader
--   reads the new documents (a new tender_reads row); the tender page shows readDiff(previous, newest)
