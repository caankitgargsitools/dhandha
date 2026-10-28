-- 56. Call learning (28 Oct 2026). Safe to run more than once.
-- If Claude cannot apply it: Supabase dashboard → SQL Editor → New query → paste this whole file → Run.
alter table public.voice_sessions add column if not exists ended_by text;

create table if not exists public.voice_lessons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id),
  company_id uuid references public.companies(id),
  sequence_id uuid references public.sequences(id),
  scope text not null check (scope in ('playbook','company','global')),
  kind text not null default 'rule' check (kind in ('rule','example')),
  situation text,
  bad text,
  better text not null check (length(better) between 3 and 1000),
  status text not null default 'active' check (status in ('active','proposed','retired','rejected')),
  starter boolean not null default false,
  shared_from uuid references public.voice_lessons(id),
  from_session uuid,
  from_turn int,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'global') = (tenant_id is null))
);
create index if not exists voice_lessons_company on public.voice_lessons (company_id, status);
alter table public.voice_lessons enable row level security;
drop policy if exists voice_lessons_read on public.voice_lessons;
create policy voice_lessons_read on public.voice_lessons for select to authenticated
  using ((tenant_id is null and status = 'active') or public.is_tenant_member(tenant_id) or public.is_platform_admin());

insert into public.price_book (action_code, module_code, name, credits, unit, note)
values ('voice_replay', 'outreach', 'Replay a call line with lessons (AI)', 1, 'replay', 'Shows what Dhandha AI would say now')
on conflict (action_code) do nothing;

create or replace function private.voice_lessons_for(p_company uuid, p_sequence uuid)
returns jsonb language sql stable security definer set search_path to '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'situation', situation, 'bad', bad, 'better', better, 'scope', scope)), '[]')
  from (select * from public.voice_lessons
        where status = 'active' and (scope = 'global' or (scope = 'company' and company_id = p_company)
              or (scope = 'playbook' and company_id = p_company and sequence_id = p_sequence))
        order by case scope when 'playbook' then 0 when 'company' then 1 else 2 end, created_at desc limit 60) l
$$;

create or replace function public.voice_session_get(p_key text, p_token uuid)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare s public.voice_sessions; l public.leads;
begin
  perform private.check_ingest_key(p_key);
  select * into s from public.voice_sessions where token = p_token;
  if s.token is null or s.status = 'ended' or (s.status = 'ready' and s.expires_at < now()) then return null; end if;
  if s.status = 'ready' then update public.voice_sessions set status = 'live', started_at = now() where token = p_token; end if;
  select * into l from public.leads where id = s.lead_id;
  return jsonb_build_object('tenant_id', s.tenant_id, 'config', s.config,
    'lessons', private.voice_lessons_for(s.company_id, s.sequence_id),
    'lead', case when l.id is null then null else jsonb_build_object('name', l.name, 'contact', l.contact_person, 'city', l.city) end);
end $function$;

drop function if exists public.voice_session_end(text, uuid, jsonb, text, text);
create or replace function public.voice_session_end(p_key text, p_token uuid, p_transcript jsonb, p_outcome text, p_summary text, p_ended_by text default null)
returns void language plpgsql security definer set search_path to '' as $function$
declare s public.voice_sessions;
begin
  perform private.check_ingest_key(p_key);
  update public.voice_sessions set status = 'ended', ended_at = now(), transcript = coalesce(p_transcript, '[]'), outcome = left(p_outcome, 40),
    summary = left(p_summary, 2000), ended_by = case when p_ended_by in ('ai','client') then p_ended_by end
  where token = p_token and status <> 'ended' returning * into s;
  if s.lead_id is not null then
    insert into public.crm_activities (tenant_id, company_id, lead_id, kind, outcome, body, created_by)
    values (s.tenant_id, s.company_id, s.lead_id, 'call', case when p_outcome in ('interested','not_interested','connected') then p_outcome else 'connected' end,
            'Dhandha AI call: ' || coalesce(left(p_summary, 1500), 'no summary'), s.user_id);
  end if;
end $function$;
revoke all on function public.voice_session_end(text, uuid, jsonb, text, text, text) from public, authenticated;
grant execute on function public.voice_session_end(text, uuid, jsonb, text, text, text) to anon;

create or replace function public.voice_lesson_save(p_id uuid, p_company uuid, p_sequence uuid, p_scope text, p_kind text,
  p_situation text, p_bad text, p_better text, p_session uuid default null, p_turn int default null)
returns uuid language plpgsql security definer set search_path to '' as $$
declare v_tenant uuid; v_id uuid;
begin
  select tenant_id into v_tenant from public.companies where id = p_company;
  if v_tenant is null or coalesce(public.tenant_role(v_tenant), '') not in ('admin','manager') then raise exception 'Only admins and managers can teach Dhandha AI'; end if;
  if p_scope not in ('playbook','company') then raise exception 'scope'; end if;
  if p_scope = 'playbook' and not exists (select 1 from public.sequences where id = p_sequence and company_id = p_company) then raise exception 'Pick the playbook'; end if;
  if length(trim(coalesce(p_better, ''))) < 3 then raise exception 'Write what Dhandha AI should say or do'; end if;
  if p_id is null then
    insert into public.voice_lessons (tenant_id, company_id, sequence_id, scope, kind, situation, bad, better, from_session, from_turn)
    values (v_tenant, p_company, case when p_scope = 'playbook' then p_sequence end, p_scope, coalesce(nullif(p_kind, ''), 'rule'),
            left(nullif(trim(p_situation), ''), 500), left(nullif(trim(p_bad), ''), 1000), left(trim(p_better), 1000), p_session, p_turn)
    returning id into v_id;
  else
    update public.voice_lessons set scope = p_scope, sequence_id = case when p_scope = 'playbook' then p_sequence end, kind = coalesce(nullif(p_kind, ''), kind),
      situation = left(nullif(trim(p_situation), ''), 500), bad = left(nullif(trim(p_bad), ''), 1000), better = left(trim(p_better), 1000), updated_at = now()
    where id = p_id and company_id = p_company returning id into v_id;
    if v_id is null then raise exception 'not found'; end if;
  end if;
  return v_id;
end $$;

create or replace function public.voice_lesson_set(p_id uuid, p_action text)
returns void language plpgsql security definer set search_path to '' as $$
declare l public.voice_lessons;
begin
  select * into l from public.voice_lessons where id = p_id;
  if l.id is null then raise exception 'not found'; end if;
  if l.tenant_id is null then
    if not public.is_platform_admin() then raise exception 'not allowed'; end if;
    update public.voice_lessons set status = case p_action when 'approve' then 'active' when 'reject' then 'rejected' when 'retire' then 'retired' when 'restore' then 'active' else status end,
      updated_at = now() where id = p_id;
    return;
  end if;
  if coalesce(public.tenant_role(l.tenant_id), '') not in ('admin','manager') then raise exception 'not allowed'; end if;
  if p_action = 'retire' then update public.voice_lessons set status = 'retired', updated_at = now() where id = p_id;
  elsif p_action = 'restore' then update public.voice_lessons set status = 'active', updated_at = now() where id = p_id;
  elsif p_action = 'share' then
    if not exists (select 1 from public.voice_lessons where shared_from = p_id) then
      insert into public.voice_lessons (scope, kind, situation, bad, better, status, shared_from, created_by)
      values ('global', l.kind, l.situation, l.bad, l.better, 'proposed', l.id, auth.uid());
    end if;
  else raise exception 'unknown action';
  end if;
end $$;

create or replace function public.voice_lesson_admin_save(p_id uuid, p_kind text, p_situation text, p_bad text, p_better text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare v_id uuid;
begin
  if not public.is_platform_admin() then raise exception 'not allowed'; end if;
  if length(trim(coalesce(p_better, ''))) < 3 then raise exception 'Write the lesson'; end if;
  if p_id is null then
    insert into public.voice_lessons (scope, kind, situation, bad, better) values ('global', coalesce(nullif(p_kind, ''), 'rule'),
      left(nullif(trim(p_situation), ''), 500), left(nullif(trim(p_bad), ''), 1000), left(trim(p_better), 1000)) returning id into v_id;
  else
    update public.voice_lessons set kind = coalesce(nullif(p_kind, ''), kind), situation = left(nullif(trim(p_situation), ''), 500),
      bad = left(nullif(trim(p_bad), ''), 1000), better = left(trim(p_better), 1000), updated_at = now()
    where id = p_id and tenant_id is null returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function public.voice_calls_for_learning(p_company uuid, p_days int default 90)
returns table (token uuid, company_id uuid, sequence_id uuid, step_no int, config jsonb, transcript jsonb, outcome text, ended_by text, summary text, started_at timestamptz, ended_at timestamptz, lead_name text, contact text)
language plpgsql stable security definer set search_path to '' as $$
begin
  if p_company is null then
    if not public.is_platform_admin() then raise exception 'not allowed'; end if;
  elsif not exists (select 1 from public.companies c where c.id = p_company and coalesce(public.tenant_role(c.tenant_id), '') in ('admin','manager')) then
    raise exception 'Only admins and managers can see call learning';
  end if;
  return query select s.token, s.company_id, s.sequence_id, s.step_no, s.config, s.transcript, s.outcome, s.ended_by, s.summary, s.started_at, s.ended_at, l.name, l.contact_person
    from public.voice_sessions s left join public.leads l on l.id = s.lead_id
    where s.status = 'ended' and jsonb_array_length(coalesce(s.transcript, '[]')) > 0 and s.ended_at > now() - make_interval(days => p_days)
      and (p_company is null or s.company_id = p_company)
    order by s.ended_at desc limit 2000;
end $$;
grant execute on function public.voice_lesson_save(uuid, uuid, uuid, text, text, text, text, text, uuid, int), public.voice_lesson_set(uuid, text),
  public.voice_lesson_admin_save(uuid, text, text, text, text), public.voice_calls_for_learning(uuid, int) to authenticated;
revoke all on function private.voice_lessons_for(uuid, uuid) from public;

-- the starter pack: lessons every Dhandha AI call follows
insert into public.voice_lessons (scope, kind, situation, bad, better, starter, created_by)
select 'global', k, s, b, t, true, null from (values
 ('rule', 'Opening the call', null, 'After the introduction, ask if this is a good time to talk before pitching anything.'),
 ('rule', 'The client is busy, driving or in a meeting', null, 'Apologise, ask for a good time to call back, confirm it in one line and end the call politely. Do not pitch.'),
 ('example', 'Explaining why you called', 'May I take 2 minutes of your time?', 'We help businesses like yours [one benefit from the script] — may I ask one quick question?'),
 ('rule', 'Every turn', null, 'Say one idea per turn, then stop and let the client speak. Ask only one question at a time.'),
 ('rule', 'The client asks about price or fees', null, 'Never guess a figure. If the script gives a price, say it; otherwise say the team will send exact details on WhatsApp today, and ask if that number is fine.'),
 ('example', 'The client says "send details on WhatsApp"', 'Sure.', 'Of course. I will have our team send the details on this number today. Is there anything specific you want us to cover?'),
 ('rule', 'The client says they already have someone (a CA, a vendor)', null, 'Respect it. Give one short reason to keep us in mind (a second opinion, a specific service) and offer to send details; if they still say no, thank them and end.'),
 ('rule', 'The client says not interested or asks not to call', null, 'Do not push. Thank them warmly, say you will not call again unless they ask, set outcome not_interested and end the call.'),
 ('rule', 'The client is annoyed or rude', null, 'Stay calm, apologise once for the disturbance, and end the call politely. Never argue.'),
 ('example', 'The client asks "Are you a robot?" or "Is this a recording?"', null, 'Yes, I am Dhandha AI, an AI assistant for [our company]. If you prefer, a person from our team can call you — shall I arrange that?'),
 ('rule', 'The client speaks Hindi or mixes Hindi and English', null, 'Switch to their language and style at once, with simple everyday words, not formal or bookish Hindi.'),
 ('rule', 'You did not understand what the client said', null, 'Say sorry, the line was not clear, and ask them to repeat — do not guess an answer.'),
 ('rule', 'The client agrees to a meeting', null, 'Thank them, say the team will send a booking link on WhatsApp so they can pick a time, confirm the number, and close. Do not start a long explanation.'),
 ('rule', 'The client asks something you were not told', null, 'Say honestly that you will have the right person from the team share it, rather than inventing an answer.'),
 ('rule', 'Before ending any call that went well', null, 'Repeat the next step in one line (what will be sent, by whom, when) and thank the client by name.'),
 ('rule', 'Wrong person or wrong number', null, 'Apologise, ask politely if they can share the right contact; if not, thank them and end.'),
 ('rule', 'Talking about the company', null, 'Never claim results, clients, certifications or discounts that are not in the script.')
) v(k, s, b, t)
where not exists (select 1 from public.voice_lessons where starter);
