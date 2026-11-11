-- 83 (11 Nov 2026): Dhandha Map (owner chose 1–5 and 11 from the "company map" idea). Applied with execute_sql.
-- company_map(company): every number the map shows in one call — nodes, automatic workers ("agents"), live activity,
-- "needs your call", connections, the pipeline flow and 8-day series for sparklines and drift alerts.
-- automation_pause(company, on): pause every automatic worker of a company at once (and put back exactly what was on).

alter table public.companies add column if not exists automation_paused_at timestamptz,
  add column if not exists automation_snapshot jsonb;

create or replace function public.company_map(p_company uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare t uuid; me uuid := auth.uid(); res jsonb; role text;
begin
  select tenant_id into t from public.companies where id = p_company;
  if t is null or not public.is_tenant_member(t) then raise exception 'not allowed'; end if;
  role := coalesce(public.tenant_role(t), '');
  select jsonb_build_object(
    'nodes', jsonb_build_object(
      'tenders', (select jsonb_build_object(
          'open', count(*) filter (where m.status = 'new' and not coalesce(m.unfit, false) and coalesce(m.ai_fit, '') <> 'no' and x.due_at > now()),
          'in_hand', count(*) filter (where m.status in ('shortlisted', 'preparing') and x.due_at > now()),
          'closing48', count(*) filter (where m.status in ('shortlisted', 'preparing') and x.due_at between now() and now() + interval '48 hours'),
          'new24', count(*) filter (where m.created_at > now() - interval '24 hours'),
          'prechecked24', count(*) filter (where x.prechecked_at > now() - interval '24 hours'))
        from public.tender_matches m join public.tenders x on x.id = m.tender_id where m.company_id = p_company),
      'leads', (select jsonb_build_object(
          'open', count(*) filter (where coalesce(status, '') not in ('won', 'lost', 'not_interested')),
          'new24', count(*) filter (where created_at > now() - interval '24 hours'),
          'cost24', coalesce(sum(cost_credits) filter (where created_at > now() - interval '24 hours'), 0),
          'followups_overdue', count(*) filter (where next_follow_up_at < now() and coalesce(status, '') not in ('won', 'lost', 'not_interested')))
        from public.leads where company_id = p_company),
      'pipeline', (select jsonb_build_object(
          'open', count(*) filter (where stage not in ('won', 'lost')),
          'open_value', coalesce(sum(value_inr) filter (where stage not in ('won', 'lost')), 0),
          'won_month', coalesce(sum(value_inr) filter (where stage = 'won' and closed_at >= date_trunc('month', now() at time zone 'Asia/Kolkata')), 0),
          'stale', count(*) filter (where stage not in ('won', 'lost') and coalesce(next_action_at, created_at) < now() - interval '7 days'))
        from public.deals where company_id = p_company),
      'outreach', (select jsonb_build_object(
          'sent24', count(*) filter (where status = 'sent' and sent_at > now() - interval '24 hours'),
          'queued', count(*) filter (where status = 'queued'),
          'failed24', count(*) filter (where status = 'failed' and created_at > now() - interval '24 hours'))
        from public.outreach_messages where company_id = p_company),
      'customers', jsonb_build_object(
          'wa_open', (select count(*) from public.wa_threads where company_id = p_company and status = 'open'),
          'wa_unassigned', (select count(*) from public.wa_threads where company_id = p_company and status = 'open' and assigned_to is null),
          'wa_unread', (select coalesce(sum(unread), 0) from public.wa_threads where company_id = p_company and status = 'open'),
          'reviews_asked30', (select count(*) from public.review_requests where company_id = p_company and created_at > now() - interval '30 days'),
          'reviews_clicked30', (select count(*) from public.review_requests where company_id = p_company and clicked_at > now() - interval '30 days'),
          'rating', (select rating from public.review_settings where company_id = p_company),
          'reviews', (select reviews from public.review_settings where company_id = p_company)),
      'work', (select jsonb_build_object(
          'active', count(*) filter (where status = 'won' and completed_on is null),
          'value', coalesce(sum(coalesce(contract_value, quoted_price)) filter (where status = 'won' and completed_on is null), 0),
          'completed90', count(*) filter (where completed_on > current_date - 90),
          'submitted', count(*) filter (where status = 'submitted'))
        from public.tender_matches where company_id = p_company),
      'backoffice', jsonb_build_object(
          'receivable', (select coalesce(sum(coalesce((totals->>'total')::numeric, 0) - coalesce(paid_amount, 0)), 0) from public.sales_invoices where company_id = p_company and status in ('issued', 'part_paid', 'overdue', 'sent')),
          'overdue', (select count(*) from public.sales_invoices where company_id = p_company and status in ('issued', 'part_paid', 'overdue', 'sent') and due_date < current_date),
          'deposits_held', (select coalesce(sum(amount), 0) from public.bid_deposits where company_id = p_company and status = 'held'),
          'refunds_due', (select coalesce(sum(amount), 0) from public.bid_deposits where company_id = p_company and status = 'refund_due')),
      'intelligence', jsonb_build_object(
          'ai_checked24', (select count(*) from public.tender_matches where company_id = p_company and ai_checked_at > now() - interval '24 hours'),
          'ai_hidden24', (select count(*) from public.tender_matches where company_id = p_company and ai_checked_at > now() - interval '24 hours' and ai_fit = 'no'),
          'rivals', (select count(*) from public.rivals where company_id = p_company and archived_at is null),
          'awards', (select count(*) from public.tender_awards)),
      'vault', (select jsonb_build_object(
          'docs', count(*),
          'expiring30', count(*) filter (where valid_until between current_date and current_date + 30),
          'expired', count(*) filter (where valid_until < current_date))
        from public.documents where company_id = p_company and status = 'active')),
    'agents', jsonb_build_array(
      (select jsonb_build_object('key', 'autopilot', 'on', coalesce(a.active, false), 'last', a.last_run_on, 'did',
          (select coalesce(sum(added), 0) from public.autopilot_runs r where r.company_id = p_company and r.created_at > now() - interval '24 hours'), 'unit', 'leads found')
        from (select 1) one left join public.lead_autopilot a on a.company_id = p_company),
      (select jsonb_build_object('key', 'ai_check', 'on', coalesce(p.ai_check, false), 'last', (select max(ai_checked_at) from public.tender_matches where company_id = p_company),
          'did', (select count(*) from public.tender_matches where company_id = p_company and ai_checked_at > now() - interval '24 hours'), 'unit', 'tenders checked')
        from (select 1) one left join public.tender_preferences p on p.company_id = p_company),
      jsonb_build_object('key', 'precheck', 'on', true,
          'last', (select max(j.updated_at) from public.tender_doc_jobs j where j.company_id = p_company and j.status in ('fetched', 'collected')),
          'did', (select count(*) from public.tender_matches m join public.tenders x on x.id = m.tender_id where m.company_id = p_company and x.prechecked_at > now() - interval '24 hours'), 'unit', 'tenders pre-checked',
          'failed', (select count(*) from public.tender_doc_jobs j where j.company_id = p_company and j.status = 'failed' and j.created_at > now() - interval '24 hours')),
      jsonb_build_object('key', 'playbooks', 'on', exists (select 1 from public.sequences where company_id = p_company and active),
          'last', (select max(sent_at) from public.outreach_messages where company_id = p_company),
          'did', (select count(*) from public.outreach_messages where company_id = p_company and sent_at > now() - interval '24 hours'), 'unit', 'messages sent'),
      jsonb_build_object('key', 'closing_alerts', 'on', true,
          'last', (select max(s.sent_at) from private.closing_alerts_sent s join public.tender_matches m on m.id = s.match_id where m.company_id = p_company),
          'did', (select count(*) from private.closing_alerts_sent s join public.tender_matches m on m.id = s.match_id where m.company_id = p_company and s.sent_at > now() - interval '24 hours'), 'unit', 'closing alerts'),
      (select jsonb_build_object('key', 'winback', 'on', coalesce(w.enabled, false),
          'last', (select max(l.created_at) from public.winback_log l join public.deals d on d.id = l.deal_id where d.company_id = p_company),
          'did', (select count(*) from public.winback_log l join public.deals d on d.id = l.deal_id where d.company_id = p_company and l.created_at > now() - interval '7 days'), 'unit', 'win-back tasks (7 days)')
        from (select 1) one left join public.winback_settings w on w.company_id = p_company),
      (select jsonb_build_object('key', 'reviews', 'on', coalesce(r.auto_ask, false),
          'last', (select max(created_at) from public.review_requests where company_id = p_company),
          'did', (select count(*) from public.review_requests where company_id = p_company and created_at > now() - interval '7 days'), 'unit', 'review requests (7 days)')
        from (select 1) one left join public.review_settings r on r.company_id = p_company),
      jsonb_build_object('key', 'corrigenda', 'on', true,
          'last', (select max(created_at) from public.tender_doc_jobs where company_id = p_company and detail->>'purpose' = 'corrigendum'),
          'did', (select count(*) from public.tender_doc_jobs where company_id = p_company and detail->>'purpose' = 'corrigendum' and created_at > now() - interval '7 days'), 'unit', 'corrigenda fetched (7 days)')),
    'activity', (select coalesce(jsonb_agg(e order by (e->>'at')::timestamptz desc), '[]') from (select u.e from (
        select jsonb_build_object('at', created_at, 'kind', 'lead', 'text', 'New lead: ' || left(name, 60) || coalesce(' (' || source || ')', ''), 'href', '/app/leads/' || id) e from public.leads where company_id = p_company and created_at > now() - interval '48 hours'
        union all select jsonb_build_object('at', created_at, 'kind', 'crm', 'text', initcap(replace(kind, '_', ' ')) || coalesce(' — ' || replace(outcome, '_', ' '), '') || coalesce(': ' || left(body, 60), ''), 'href', case when lead_id is not null then '/app/leads/' || lead_id end) from public.crm_activities where company_id = p_company and created_at > now() - interval '48 hours'
        union all select jsonb_build_object('at', closed_at, 'kind', 'deal', 'text', 'Deal ' || stage || ': ' || left(title, 60) || coalesce(' ₹' || to_char(value_inr, 'FM99,99,99,999'), ''), 'href', '/app/crm/' || id) from public.deals where company_id = p_company and stage in ('won', 'lost') and closed_at > now() - interval '48 hours'
        union all select jsonb_build_object('at', coalesce(responded_at, sent_at), 'kind', 'quote', 'text', 'Quotation ' || number || ' ' || status || ' — ' || left(client_name, 50), 'href', '/app/crm/quotes/' || id) from public.quotes where company_id = p_company and coalesce(responded_at, sent_at) > now() - interval '48 hours'
        union all select jsonb_build_object('at', coalesce(paid_at, issued_at), 'kind', 'invoice', 'text', 'Invoice ' || coalesce(number, '') || ' ' || status || ' — ' || left(client_name, 50), 'href', '/app/crm/invoices/' || id) from public.sales_invoices where company_id = p_company and coalesce(paid_at, issued_at) > now() - interval '48 hours'
        union all select jsonb_build_object('at', m.submitted_at, 'kind', 'tender', 'text', 'Bid filed: ' || left(x.title, 70), 'href', '/app/tenders/' || m.id) from public.tender_matches m join public.tenders x on x.id = m.tender_id where m.company_id = p_company and m.submitted_at > now() - interval '48 hours'
        union all select jsonb_build_object('at', m.result_at, 'kind', 'tender', 'text', 'Result: ' || m.status || ' — ' || left(x.title, 60), 'href', '/app/tenders/' || m.id) from public.tender_matches m join public.tenders x on x.id = m.tender_id where m.company_id = p_company and m.result_at > now() - interval '48 hours'
        union all select jsonb_build_object('at', b.created_at, 'kind', 'tender', 'text', 'Bid file made (' || b.kind || '): ' || left(x.title, 60), 'href', '/app/tenders/' || b.match_id) from public.bid_packs b join public.tenders x on x.id = b.tender_id where b.company_id = p_company and b.created_at > now() - interval '48 hours'
        union all select jsonb_build_object('at', c.created_at, 'kind', 'note', 'text', 'Team note: ' || left(c.body, 70), 'href', '/app/tenders/' || c.match_id || '#comments') from public.tender_comments c where c.company_id = p_company and c.archived_at is null and c.created_at > now() - interval '48 hours'
        union all select jsonb_build_object('at', r.created_at, 'kind', 'agent', 'text', 'Autopilot found ' || r.added || ' leads (' || r.source || ')', 'href', '/app/leads/autopilot') from public.autopilot_runs r where r.company_id = p_company and r.created_at > now() - interval '48 hours'
        union all select jsonb_build_object('at', completed_at, 'kind', 'task', 'text', 'Task done: ' || left(title, 70), 'href', '/app/tasks') from public.tasks where company_id = p_company and completed_at > now() - interval '48 hours'
        ) u(e) where e->>'at' is not null order by (u.e->>'at')::timestamptz desc limit 40) z(e)),
    'needs', jsonb_build_object(
      'tasks', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'due', due_at, 'priority', priority) order by due_at), '[]') from (
          select id, title, due_at, priority from public.tasks where company_id = p_company and assigned_to = me and status in ('todo', 'in_progress') and due_at < now() + interval '1 day' order by due_at limit 6) k),
      'tasks_count', (select count(*) from public.tasks where company_id = p_company and assigned_to = me and status in ('todo', 'in_progress') and due_at < now() + interval '1 day'),
      'closing', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'title', left(x.title, 90), 'due', x.due_at, 'status', m.status) order by x.due_at), '[]') from public.tender_matches m join public.tenders x on x.id = m.tender_id
          where m.company_id = p_company and m.status in ('shortlisted', 'preparing') and x.due_at between now() and now() + interval '72 hours'),
      'quotes_to_invoice', (select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'number', q.number, 'client', q.client_name)), '[]') from public.quotes q
          where q.company_id = p_company and q.status = 'accepted' and not exists (select 1 from public.sales_invoices i where i.quote_id = q.id)),
      'wa_unassigned', (select count(*) from public.wa_threads where company_id = p_company and status = 'open' and assigned_to is null),
      'followups', (select count(*) from public.leads where company_id = p_company and owner_id = me and next_follow_up_at < now() and coalesce(status, '') not in ('won', 'lost', 'not_interested')),
      'partners', (select count(*) from public.partner_requests where to_company = p_company and status = 'pending'),
      'resets', case when role = 'admin' then (select count(*) from private.password_resets r join public.tenant_members tm on tm.user_id = r.user_id and tm.tenant_id = t where r.used_at is null and r.expires_at > now()) else 0 end),
    'connections', jsonb_build_object(
      'whatsapp', (select wa_phone_number_id is not null from public.outreach_settings where tenant_id = t),
      'wa_inbox', (select wa_app_secret is not null and wa_hook_token is not null from public.outreach_settings where tenant_id = t),
      'email', coalesce((select value = 'true' from private.app_config where key = 'email_ready'), false),
      'drive', exists (select 1 from public.drive_connections where tenant_id = t and token_enc is not null and revoked_at is null),
      'gmail', (select jsonb_build_object('on', enabled, 'last', last_at) from public.email_hooks where company_id = p_company),
      'google_ads', (select jsonb_build_object('last', last_lead_at, 'leads', leads) from public.google_ads_hooks where company_id = p_company),
      'meta', (select count(*) from public.meta_pages where company_id = p_company and revoked_at is null),
      'apollo', exists (select 1 from public.lead_connectors where tenant_id = t and apollo_key_secret is not null),
      'maps', (select jsonb_build_object('ok', ok, 'at', created_at) from private.health_checks where name ilike '%route%' or name ilike '%maps%' order by created_at desc limit 1),
      'crawler', (select started_at from public.crawl_runs order by id desc limit 1),
      'sessions_live', (select count(*) from public.portal_sessions where state = 'live')),
    'flow', jsonb_build_object(
      'tenders', (select jsonb_build_object(
          'found', count(*) filter (where m.status = 'new' and not coalesce(m.unfit, false) and coalesce(m.ai_fit, '') <> 'no' and x.due_at > now()),
          'shortlisted', count(*) filter (where m.status = 'shortlisted' and x.due_at > now()),
          'preparing', count(*) filter (where m.status = 'preparing' and x.due_at > now()),
          'stuck_preparing', count(*) filter (where m.status = 'preparing' and x.due_at between now() and now() + interval '48 hours' and m.quoted_price is null),
          'submitted', count(*) filter (where m.status = 'submitted'),
          'won', count(*) filter (where m.status = 'won' and coalesce(m.result_at, m.created_at) > now() - interval '180 days'),
          'delivering', count(*) filter (where m.status = 'won' and m.completed_on is null))
        from public.tender_matches m join public.tenders x on x.id = m.tender_id where m.company_id = p_company),
      'deals', (select coalesce(jsonb_object_agg(stage, n), '{}') from (select stage, count(*) n from public.deals where company_id = p_company and (stage not in ('won', 'lost') or closed_at > now() - interval '90 days') group by stage) s),
      'paid', jsonb_build_object(
          'outstanding', (select count(*) from public.sales_invoices where company_id = p_company and status in ('issued', 'part_paid', 'overdue', 'sent')),
          'paid90', (select count(*) from public.sales_invoices where company_id = p_company and status = 'paid' and paid_at > now() - interval '90 days'))),
    'series', jsonb_build_object(
      'leads', (select jsonb_agg(coalesce(n, 0) order by d) from generate_series(current_date - 7, current_date, interval '1 day') d
          left join (select (created_at at time zone 'Asia/Kolkata')::date dd, count(*) n from public.leads where company_id = p_company and created_at > now() - interval '9 days' group by 1) l on l.dd = d::date),
      'matches', (select jsonb_agg(coalesce(n, 0) order by d) from generate_series(current_date - 7, current_date, interval '1 day') d
          left join (select (created_at at time zone 'Asia/Kolkata')::date dd, count(*) n from public.tender_matches where company_id = p_company and created_at > now() - interval '9 days' group by 1) l on l.dd = d::date),
      'messages', (select jsonb_agg(coalesce(n, 0) order by d) from generate_series(current_date - 7, current_date, interval '1 day') d
          left join (select (sent_at at time zone 'Asia/Kolkata')::date dd, count(*) n from public.outreach_messages where company_id = p_company and sent_at > now() - interval '9 days' group by 1) l on l.dd = d::date)),
    'paused', (select automation_paused_at from public.companies where id = p_company),
    'role', role
  ) into res;
  return res;
end $$;
revoke all on function public.company_map(uuid) from public, anon;
grant execute on function public.company_map(uuid) to authenticated;

-- Pause every automatic worker of a company (autopilot, AI tender check, playbooks, win-back, review requests) and
-- remember which were on; resume puts back exactly those. Admins and managers only; audited.
create or replace function public.automation_pause(p_company uuid, p_on boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t uuid; snap jsonb;
begin
  select tenant_id into t from public.companies where id = p_company;
  if t is null or coalesce(public.tenant_role(t), '') not in ('admin', 'manager') then raise exception 'Only admins and managers can pause automations.'; end if;
  if p_on then
    if (select automation_paused_at from public.companies where id = p_company) is not null then return jsonb_build_object('paused', true); end if;
    snap := jsonb_build_object(
      'autopilot', (select active from public.lead_autopilot where company_id = p_company),
      'ai_check', (select ai_check from public.tender_preferences where company_id = p_company),
      'sequences', (select coalesce(jsonb_agg(id), '[]') from public.sequences where company_id = p_company and active),
      'winback', (select enabled from public.winback_settings where company_id = p_company),
      'reviews', (select auto_ask from public.review_settings where company_id = p_company));
    update public.lead_autopilot set active = false where company_id = p_company;
    update public.tender_preferences set ai_check = false where company_id = p_company;
    update public.sequences set active = false where company_id = p_company and active;
    update public.winback_settings set enabled = false where company_id = p_company;
    update public.review_settings set auto_ask = false where company_id = p_company;
    update public.companies set automation_paused_at = now(), automation_snapshot = snap where id = p_company;
  else
    select automation_snapshot into snap from public.companies where id = p_company;
    if snap is null then return jsonb_build_object('paused', false); end if;
    update public.lead_autopilot set active = coalesce((snap->>'autopilot')::boolean, active) where company_id = p_company;
    update public.tender_preferences set ai_check = coalesce((snap->>'ai_check')::boolean, ai_check) where company_id = p_company;
    update public.sequences set active = true where company_id = p_company and id in (select (x)::uuid from jsonb_array_elements_text(coalesce(snap->'sequences', '[]')) x);
    update public.winback_settings set enabled = coalesce((snap->>'winback')::boolean, enabled) where company_id = p_company;
    update public.review_settings set auto_ask = coalesce((snap->>'reviews')::boolean, auto_ask) where company_id = p_company;
    update public.companies set automation_paused_at = null, automation_snapshot = null where id = p_company;
  end if;
  insert into public.audit_log (tenant_id, company_id, user_id, action, entity, entity_id, detail)
  values (t, p_company, auth.uid(), case when p_on then 'automation_paused' else 'automation_resumed' end, 'company', p_company, coalesce(snap, '{}'::jsonb));
  return jsonb_build_object('paused', p_on);
end $$;
revoke all on function public.automation_pause(uuid, boolean) from public, anon;
grant execute on function public.automation_pause(uuid, boolean) to authenticated;
