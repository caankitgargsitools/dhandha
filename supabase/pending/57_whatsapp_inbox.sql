-- 57. Two-way WhatsApp inbox (C1, 28 Oct 2026). Safe to run more than once.
-- Each workspace's own WhatsApp Cloud API app sends its webhook to /api/whatsapp/webhook/<token>; the signature is
-- checked here against that workspace's app secret (Vault). Replies are matched to leads, assigned, can get an
-- auto-reply, stop the lead's playbook, and can be answered from Dhandha (free text inside WhatsApp's 24-hour window,
-- an approved template outside it).

alter table public.leads drop constraint if exists leads_source_check;
alter table public.leads add constraint leads_source_check check (source = any (array['google_maps','mca','indiamart','website','directory',
  'tender_winner','upload','referral','linkedin','facebook','instagram','apollo','database','google_ads','whatsapp']));

alter table public.outreach_settings
  add column if not exists wa_hook_token uuid,
  add column if not exists wa_verify_token text,
  add column if not exists wa_app_secret uuid,
  add column if not exists wa_auto_reply text,
  add column if not exists wa_auto_when text not null default 'off',
  add column if not exists wa_assign text not null default 'owner';
alter table public.outreach_settings drop constraint if exists outreach_settings_wa_auto_when_check;
alter table public.outreach_settings add constraint outreach_settings_wa_auto_when_check check (wa_auto_when in ('off','first','outside_hours','always'));
alter table public.outreach_settings drop constraint if exists outreach_settings_wa_assign_check;
alter table public.outreach_settings add constraint outreach_settings_wa_assign_check check (wa_assign in ('owner','round_robin','unassigned'));

create table if not exists public.wa_threads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  company_id uuid references public.companies(id),
  lead_id uuid references public.leads(id),
  phone text not null,               -- 10 digits
  wa_id text,                        -- WhatsApp's id (country code + number)
  name text,
  assigned_to uuid,
  status text not null default 'open' check (status in ('open','closed')),
  unread int not null default 0,
  last_in_at timestamptz,            -- the 24-hour window counts from here
  last_at timestamptz not null default now(),
  last_text text,
  created_at timestamptz not null default now(),
  unique (tenant_id, phone)
);
create index if not exists wa_threads_list on public.wa_threads (tenant_id, status, last_at desc);

create table if not exists public.wa_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.wa_threads(id),
  tenant_id uuid not null,
  direction text not null check (direction in ('in','out')),
  kind text not null default 'text' check (kind in ('text','template','media','other')),
  body text,
  template text,
  status text not null default 'received' check (status in ('received','queued','sending','sent','delivered','read','failed')),
  error text,
  wa_message_id text,
  auto boolean not null default false,
  sent_by uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists wa_messages_waid on public.wa_messages (wa_message_id) where wa_message_id is not null;
create index if not exists wa_messages_thread on public.wa_messages (thread_id, id);
create index if not exists wa_messages_queue on public.wa_messages (status) where status = 'queued';

alter table public.wa_threads enable row level security;
alter table public.wa_messages enable row level security;
drop policy if exists wa_threads_read on public.wa_threads;
create policy wa_threads_read on public.wa_threads for select to authenticated
  using (public.is_tenant_member(tenant_id) and (public.sees_all_leads(tenant_id) or assigned_to = auth.uid()
         or exists (select 1 from public.leads l where l.id = lead_id and l.owner_id = auth.uid())));
drop policy if exists wa_messages_read on public.wa_messages;
create policy wa_messages_read on public.wa_messages for select to authenticated
  using (exists (select 1 from public.wa_threads t where t.id = thread_id));

-- settings: webhook address token, verify token, app secret (Vault), auto-reply, assignment
create or replace function public.wa_inbox_setup(p_tenant uuid, p_app_secret text default null, p_auto_reply text default null, p_auto_when text default null, p_assign text default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_tenant uuid := p_tenant; s public.outreach_settings; v_secret uuid;
begin
  if not public.is_tenant_admin(p_tenant) then raise exception 'Only the workspace admin can set up the WhatsApp inbox'; end if;
  insert into public.outreach_settings (tenant_id) values (v_tenant) on conflict (tenant_id) do nothing;
  update public.outreach_settings set wa_hook_token = coalesce(wa_hook_token, gen_random_uuid()),
    wa_verify_token = coalesce(wa_verify_token, encode(extensions.gen_random_bytes(12), 'hex')) where tenant_id = v_tenant;
  if nullif(trim(p_app_secret), '') is not null then
    select wa_app_secret into v_secret from public.outreach_settings where tenant_id = v_tenant;
    if v_secret is null then
      v_secret := vault.create_secret(trim(p_app_secret), 'wa_app_secret_' || v_tenant::text, 'WhatsApp app secret (webhook signatures)');
      update public.outreach_settings set wa_app_secret = v_secret where tenant_id = v_tenant;
    else
      perform vault.update_secret(v_secret, trim(p_app_secret));
    end if;
  end if;
  update public.outreach_settings set
    wa_auto_reply = case when p_auto_reply is null then wa_auto_reply else left(nullif(trim(p_auto_reply), ''), 1000) end,
    wa_auto_when = coalesce(nullif(p_auto_when, ''), wa_auto_when),
    wa_assign = coalesce(nullif(p_assign, ''), wa_assign), updated_at = now()
  where tenant_id = v_tenant returning * into s;
  return jsonb_build_object('hook_token', s.wa_hook_token, 'verify_token', s.wa_verify_token, 'has_secret', s.wa_app_secret is not null,
    'auto_reply', s.wa_auto_reply, 'auto_when', s.wa_auto_when, 'assign', s.wa_assign);
end $$;

-- Meta's subscribe check: the verify token for this webhook address
create or replace function public.wa_hook_verify(p_token uuid, p_verify text)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.outreach_settings where wa_hook_token = p_token and wa_verify_token = p_verify)
$$;

-- who gets a new conversation
create or replace function private.wa_pick_assignee(p_tenant uuid, p_lead uuid, p_mode text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare v uuid;
begin
  if p_mode = 'unassigned' then return null; end if;
  select owner_id into v from public.leads where id = p_lead;
  if v is not null and p_mode = 'owner' then return v; end if;
  -- round robin: the admin / manager / telecaller with the fewest open conversations
  select m.user_id into v from public.tenant_members m
  where m.tenant_id = p_tenant and m.role in ('admin','manager','telecaller')
  order by (select count(*) from public.wa_threads t where t.tenant_id = p_tenant and t.assigned_to = m.user_id and t.status = 'open'), m.created_at
  limit 1;
  return v;
end $$;

-- the webhook: messages in, delivery statuses for what we sent
create or replace function public.wa_webhook(p_token uuid, p_body text, p_signature text)
returns integer language plpgsql security definer set search_path to '' as $$
declare s public.outreach_settings; v_secret text; e jsonb; c jsonb; m jsonb; st jsonb; n int := 0;
  v_phone text; v_name text; v_text text; v_kind text; v_lead uuid; v_company uuid; t public.wa_threads; v_new boolean; v_hours boolean; seq public.sequences;
begin
  select * into s from public.outreach_settings where wa_hook_token = p_token;
  if s.tenant_id is null then raise exception 'unknown webhook'; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where id = s.wa_app_secret;
  if v_secret is null then raise exception 'app secret not set'; end if;
  if 'sha256=' || encode(extensions.hmac(convert_to(coalesce(p_body, ''), 'UTF8'), convert_to(v_secret, 'UTF8'), 'sha256'), 'hex') <> lower(coalesce(p_signature, '')) then
    raise exception 'bad signature';
  end if;
  for e in select * from jsonb_array_elements(coalesce(p_body::jsonb->'entry', '[]')) loop
    for c in select * from jsonb_array_elements(coalesce(e->'changes', '[]')) loop
      continue when c->>'field' <> 'messages';
      -- delivery / read receipts for our messages
      for st in select * from jsonb_array_elements(coalesce(c#>'{value,statuses}', '[]')) loop
        update public.wa_messages set status = case st->>'status' when 'failed' then 'failed' when 'read' then 'read' when 'delivered' then case when status = 'read' then status else 'delivered' end else status end,
          error = case when st->>'status' = 'failed' then left(coalesce(st#>>'{errors,0,title}', st#>>'{errors,0,message}', 'failed'), 300) else error end
        where wa_message_id = st->>'id' and tenant_id = s.tenant_id;
      end loop;
      for m in select * from jsonb_array_elements(coalesce(c#>'{value,messages}', '[]')) loop
        continue when exists (select 1 from public.wa_messages where wa_message_id = m->>'id');
        v_phone := right(regexp_replace(coalesce(m->>'from', ''), '\D', '', 'g'), 10);
        continue when length(v_phone) < 10;
        v_name := null;
        select x->'profile'->>'name' into v_name from jsonb_array_elements(coalesce(c#>'{value,contacts}', '[]')) x where x->>'wa_id' = m->>'from' limit 1;
        v_kind := m->>'type';
        v_text := case v_kind when 'text' then m#>>'{text,body}' when 'button' then m#>>'{button,text}'
          when 'interactive' then coalesce(m#>>'{interactive,button_reply,title}', m#>>'{interactive,list_reply,title}')
          when 'image' then '[photo] ' || coalesce(m#>>'{image,caption}', '') when 'document' then '[document] ' || coalesce(m#>>'{document,filename}', '')
          when 'audio' then '[voice note]' when 'video' then '[video]' when 'location' then '[location]' else '[' || coalesce(v_kind, 'message') || ']' end;
        -- the lead: by phone in this workspace, else a new lead
        select id, company_id into v_lead, v_company from public.leads where tenant_id = s.tenant_id and phone_norm = v_phone order by created_at limit 1;
        if v_lead is null then
          select id into v_company from public.companies where tenant_id = s.tenant_id order by created_at limit 1;
          insert into public.leads (tenant_id, company_id, name, contact_person, phone, source, wa_opt_in, notes)
          values (s.tenant_id, v_company, coalesce(nullif(v_name, ''), '+91 ' || v_phone), nullif(v_name, ''), v_phone, 'whatsapp', true, 'First message on WhatsApp')
          returning id into v_lead;
        else
          update public.leads set wa_opt_in = true, last_contacted_at = now() where id = v_lead;
        end if;
        select * into t from public.wa_threads where tenant_id = s.tenant_id and phone = v_phone;
        v_new := t.id is null;
        if v_new then
          insert into public.wa_threads (tenant_id, company_id, lead_id, phone, wa_id, name, assigned_to)
          values (s.tenant_id, v_company, v_lead, v_phone, m->>'from', v_name, private.wa_pick_assignee(s.tenant_id, v_lead, s.wa_assign))
          returning * into t;
        end if;
        insert into public.wa_messages (thread_id, tenant_id, direction, kind, body, status, wa_message_id)
        values (t.id, s.tenant_id, 'in', case when v_kind in ('text','button','interactive') then 'text' when v_kind in ('image','document','audio','video') then 'media' else 'other' end,
                left(v_text, 4000), 'received', m->>'id');
        update public.wa_threads set unread = unread + 1, last_in_at = now(), last_at = now(), last_text = left(v_text, 200), status = 'open',
          name = coalesce(nullif(v_name, ''), name), lead_id = coalesce(lead_id, v_lead) where id = t.id;
        -- a reply stops the lead's playbook and goes on the timeline
        update public.enrollments set status = 'replied', stopped_reason = 'Replied on WhatsApp' where lead_id = v_lead and status = 'active';
        insert into public.crm_activities (tenant_id, company_id, lead_id, kind, outcome, body)
        values (s.tenant_id, v_company, v_lead, 'whatsapp', 'connected', left('WhatsApp from the client: ' || v_text, 4000));
        -- tell the person handling it
        insert into public.push_queue (user_id, title, body, url, tag)
        select u, 'WhatsApp: ' || coalesce(nullif(v_name, ''), '+91 ' || v_phone), left(v_text, 140), '/app/inbox?t=' || t.id, 'wa-' || t.id
        from (select coalesce(t.assigned_to, (select m2.user_id from public.tenant_members m2 where m2.tenant_id = s.tenant_id and m2.role = 'admin' order by m2.created_at limit 1)) u) x
        where u is not null;
        -- auto-reply (free text: the client just wrote, so the 24-hour window is open)
        if s.wa_auto_reply is not null and s.wa_auto_when <> 'off' then
          select * into seq from public.sequences where company_id = v_company and trigger = 'new_lead' order by created_at limit 1;
          v_hours := (extract(isodow from now() at time zone 'Asia/Kolkata')::int = any (coalesce(seq.office_days, array[1,2,3,4,5,6])))
            and (now() at time zone 'Asia/Kolkata')::time between coalesce(seq.office_from, '09:30') and coalesce(seq.office_to, '18:30');
          if s.wa_auto_when = 'always' or (s.wa_auto_when = 'first' and v_new) or (s.wa_auto_when = 'outside_hours' and not v_hours) then
            if not exists (select 1 from public.wa_messages where thread_id = t.id and auto and created_at > now() - interval '12 hours') then
              insert into public.wa_messages (thread_id, tenant_id, direction, kind, body, status, auto)
              values (t.id, s.tenant_id, 'out', 'text', s.wa_auto_reply, 'queued', true);
            end if;
          end if;
        end if;
        n := n + 1;
      end loop;
    end loop;
  end loop;
  if n > 0 then perform public.worker_kick('/api/push/run'); perform public.outreach_kick(); end if;
  return n;
end $$;
revoke all on function public.wa_webhook(uuid, text, text) from public;
grant execute on function public.wa_webhook(uuid, text, text), public.wa_hook_verify(uuid, text) to anon;

-- the team answers from Dhandha: free text inside 24 hours of the client's last message, else an approved template
create or replace function public.wa_reply(p_thread uuid, p_text text, p_template text default null, p_lang text default 'en')
returns bigint language plpgsql security definer set search_path to '' as $$
declare t public.wa_threads; v_id bigint;
begin
  select * into t from public.wa_threads where id = p_thread;
  if t.id is null or not public.can_write(t.tenant_id) then raise exception 'not allowed'; end if;
  if not (public.sees_all_leads(t.tenant_id) or t.assigned_to = auth.uid() or exists (select 1 from public.leads l where l.id = t.lead_id and l.owner_id = auth.uid())) then
    raise exception 'This conversation is assigned to someone else';
  end if;
  if nullif(trim(p_template), '') is null then
    if t.last_in_at is null or t.last_in_at < now() - interval '24 hours' then
      raise exception 'More than 24 hours since the client last wrote — WhatsApp allows only an approved template now';
    end if;
    if length(trim(coalesce(p_text, ''))) = 0 then raise exception 'Write a message'; end if;
    insert into public.wa_messages (thread_id, tenant_id, direction, kind, body, status, sent_by)
    values (t.id, t.tenant_id, 'out', 'text', left(trim(p_text), 4000), 'queued', auth.uid()) returning id into v_id;
  else
    insert into public.wa_messages (thread_id, tenant_id, direction, kind, body, template, status, sent_by)
    values (t.id, t.tenant_id, 'out', 'template', 'Template: ' || trim(p_template), lower(trim(p_template)) || '|' || coalesce(nullif(p_lang, ''), 'en'), 'queued', auth.uid()) returning id into v_id;
  end if;
  update public.wa_threads set last_at = now(), last_text = left(coalesce(nullif(trim(p_text), ''), 'Template: ' || p_template), 200), unread = 0,
    assigned_to = coalesce(assigned_to, auth.uid()) where id = t.id;
  if t.lead_id is not null then
    insert into public.crm_activities (tenant_id, company_id, lead_id, kind, outcome, body, created_by)
    values (t.tenant_id, t.company_id, t.lead_id, 'whatsapp', 'sent', left('WhatsApp to the client: ' || coalesce(nullif(trim(p_text), ''), 'template ' || p_template), 4000), auth.uid());
  end if;
  perform public.outreach_kick();
  return v_id;
end $$;

create or replace function public.wa_thread_set(p_thread uuid, p_action text, p_user uuid default null)
returns void language plpgsql security definer set search_path to '' as $$
declare t public.wa_threads;
begin
  select * into t from public.wa_threads where id = p_thread;
  if t.id is null or not public.can_write(t.tenant_id) then raise exception 'not allowed'; end if;
  if p_action = 'read' then update public.wa_threads set unread = 0 where id = p_thread;
  elsif p_action = 'close' then update public.wa_threads set status = 'closed', unread = 0 where id = p_thread;
  elsif p_action = 'open' then update public.wa_threads set status = 'open' where id = p_thread;
  elsif p_action = 'assign' then
    if not public.sees_all_leads(t.tenant_id) and p_user is distinct from auth.uid() then raise exception 'Only admins and managers can assign to others'; end if;
    if p_user is not null and not exists (select 1 from public.tenant_members where tenant_id = t.tenant_id and user_id = p_user) then raise exception 'not a member'; end if;
    update public.wa_threads set assigned_to = p_user where id = p_thread;
    if p_user is not null and p_user <> auth.uid() then
      insert into public.push_queue (user_id, title, body, url, tag) values (p_user, 'WhatsApp conversation for you', coalesce(t.name, '+91 ' || t.phone) || ': ' || coalesce(t.last_text, ''), '/app/inbox?t=' || t.id, 'wa-' || t.id);
      perform public.worker_kick('/api/push/run');
    end if;
  else raise exception 'unknown action';
  end if;
end $$;
grant execute on function public.wa_inbox_setup(uuid, text, text, text, text), public.wa_reply(uuid, text, text, text), public.wa_thread_set(uuid, text, uuid) to authenticated;

-- the worker sends queued inbox messages with the workspace's own WhatsApp number
create or replace function public.wa_inbox_claim(p_key text, p_limit int default 30)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare r jsonb;
begin
  if not private.outreach_key_ok(p_key) then raise exception 'bad worker key'; end if;
  with c as (
    update public.wa_messages w set status = 'sending' where w.id in (
      select id from public.wa_messages where status = 'queued' and direction = 'out' order by id limit greatest(1, least(p_limit, 100)) for update skip locked)
    returning w.*)
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'kind', c.kind, 'body', c.body, 'template', c.template,
    'to', t.phone, 'name', coalesce(l.contact_person, t.name, l.name), 'company', co.legal_name,
    'wa_phone_number_id', s.wa_phone_number_id, 'wa_token', (select decrypted_secret from vault.decrypted_secrets where id = s.wa_token_secret))), '[]')
  into r
  from c join public.wa_threads t on t.id = c.thread_id
  left join public.leads l on l.id = t.lead_id
  left join public.companies co on co.id = t.company_id
  left join public.outreach_settings s on s.tenant_id = c.tenant_id;
  return r;
end $$;

create or replace function public.wa_inbox_report(p_key text, p_results jsonb)
returns void language plpgsql security definer set search_path to '' as $$
declare x jsonb;
begin
  if not private.outreach_key_ok(p_key) then raise exception 'bad worker key'; end if;
  for x in select * from jsonb_array_elements(coalesce(p_results, '[]')) loop
    update public.wa_messages set status = case when (x->>'ok')::boolean then 'sent' else 'failed' end,
      wa_message_id = nullif(x->>'provider_id', 'sent'), error = left(x->>'error', 300)
    where id = (x->>'id')::bigint and status = 'sending';
  end loop;
end $$;
grant execute on function public.wa_inbox_claim(text, int), public.wa_inbox_report(text, jsonb) to anon;

-- the outreach worker also wakes for queued inbox replies
create or replace function public.outreach_kick_if_due()
returns boolean language sql security definer set search_path to '' as $function$
  select (case when exists (select 1 from public.outreach_messages where status = 'queued')
              or exists (select 1 from public.enrollments where status = 'active' and next_at <= now())
              or exists (select 1 from public.playbook_actions where status = 'queued')
              or exists (select 1 from public.wa_messages where status = 'queued')
         then public.outreach_kick() else false end)
       or (case when exists (select 1 from public.meta_lead_jobs where status = 'queued') then public.worker_kick('/api/meta/run') else false end);
$function$;
