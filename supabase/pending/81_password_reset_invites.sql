-- 81 (4 Nov 2026): forgot password without a mailer, 2FA reset by a platform admin, invite links that expire,
-- billing company, archived Vault documents. Brief section 1 (bugs 1, 2, 5, 8).

-- 1. billing company: Dhandha's own invoices always go to one company of the workspace
alter table public.tenants add column if not exists billing_company_id uuid references public.companies(id);
update public.tenants t set billing_company_id = (select c.id from public.companies c where c.tenant_id = t.id order by c.created_at limit 1)
where billing_company_id is null;

create or replace function public.set_billing_company(p_tenant uuid, p_company uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.tenant_role(p_tenant), '') <> 'admin' then raise exception 'Only the workspace admin can choose the billing company.'; end if;
  if not exists (select 1 from public.companies where id = p_company and tenant_id = p_tenant) then raise exception 'That company is not in this workspace.'; end if;
  update public.tenants set billing_company_id = p_company where id = p_tenant;
  insert into public.audit_log (tenant_id, company_id, user_id, action, entity, entity_id, detail)
  values (p_tenant, p_company, auth.uid(), 'billing_company_set', 'tenant', p_tenant, '{}'::jsonb);
end $$;
revoke all on function public.set_billing_company(uuid, uuid) from public, anon;
grant execute on function public.set_billing_company(uuid, uuid) to authenticated;

-- 5. Vault documents are archived, never deleted (the file stays in storage)
alter table public.documents add column if not exists archived_at timestamptz, add column if not exists archived_by uuid,
  add column if not exists replaces_id uuid references public.documents(id);

-- 8. invite links: 72 hours, confirm one sign-up; "New link" makes a fresh token
alter table public.invites add column if not exists link_expires_at timestamptz, add column if not exists link_used_at timestamptz;
update public.invites set link_expires_at = greatest(created_at + interval '72 hours', now() + interval '72 hours')
where link_expires_at is null and accepted_at is null and revoked_at is null;
alter table public.invites alter column link_expires_at set default now() + interval '72 hours';
-- confirm_invited_signup: `link_used_at is null and link_expires_at > now()`, and sets link_used_at once it confirms
-- (edited in place with pg_get_functiondef + replace; see the session log of 4 Nov).
create or replace function public.invite_renew(p_invite uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare t uuid; tok uuid := gen_random_uuid();
begin
  select tenant_id into t from public.invites where id = p_invite and accepted_at is null and revoked_at is null;
  if t is null then raise exception 'Invite not found.'; end if;
  if coalesce(public.tenant_role(t), '') <> 'admin' then raise exception 'Only the workspace admin can do this.'; end if;
  update public.invites set token = tok, link_expires_at = now() + interval '72 hours', link_used_at = null where id = p_invite;
  return tok;
end $$;
revoke all on function public.invite_renew(uuid) from public, anon;
grant execute on function public.invite_renew(uuid) to authenticated;

create or replace function public.invite_info(p_token uuid) returns jsonb
language sql stable security definer set search_path to '' as $function$
  select jsonb_build_object('email', i.email, 'full_name', i.full_name, 'role', i.role, 'workspace', t.name,
    'expired', i.link_used_at is not null or coalesce(i.link_expires_at, i.created_at + interval '72 hours') <= now())
  from public.invites i join public.tenants t on t.id = i.tenant_id
  where i.token = p_token and i.accepted_at is null and i.revoked_at is null;
$function$;

-- 2. forgot password: Supabase's own mailer does not reach outside addresses and there is no mail provider yet, so a
-- request makes a one-time link (24 h) that the person's workspace admin and the platform admins see and pass on
-- (WhatsApp). The link sets a new password. Nothing says whether the e-mail exists.
create table if not exists private.password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  used_at timestamptz,
  ip_hash text
);
create index if not exists password_resets_user on private.password_resets (user_id, created_at desc);

create or replace function public.password_reset_request(p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid; uname text; a record;
begin
  select id, coalesce(raw_user_meta_data->>'full_name', email) into u, uname from auth.users where lower(email) = lower(trim(coalesce(p_email, ''))) limit 1;
  if u is null then return; end if;
  -- at most 3 requests an hour per login
  if (select count(*) from private.password_resets where user_id = u and created_at > now() - interval '1 hour') >= 3 then return; end if;
  insert into private.password_resets (user_id) values (u);
  -- tell the people who can pass the link on: the person's workspace admins, else the platform admins
  for a in
    select distinct m2.user_id from public.tenant_members m join public.tenant_members m2 on m2.tenant_id = m.tenant_id
    where m.user_id = u and m2.role = 'admin' and m2.user_id <> u
    union select user_id from public.platform_admins
  loop
    perform private.push_to(a.user_id, 'Password reset asked', uname || ' asked to reset their Dhandha password. Open Team to copy the link and send it to them.', '/app/settings/team', 'pwreset:' || u);
  end loop;
end $$;
revoke all on function public.password_reset_request(text) from public;
grant execute on function public.password_reset_request(text) to anon, authenticated;

-- open reset links the caller may pass on: for members of a workspace they administer (or all, for platform admins)
create or replace function public.password_reset_links(p_tenant uuid default null) returns table (user_id uuid, email text, full_name text, token uuid, created_at timestamptz, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.user_id, u.email::text, coalesce(u.raw_user_meta_data->>'full_name', u.email)::text, r.token, r.created_at, r.expires_at
  from private.password_resets r join auth.users u on u.id = r.user_id
  where r.used_at is null and r.expires_at > now()
    and r.created_at = (select max(r2.created_at) from private.password_resets r2 where r2.user_id = r.user_id)
    and (public.is_platform_admin()
         or (p_tenant is not null and coalesce(public.tenant_role(p_tenant), '') = 'admin'
             and exists (select 1 from public.tenant_members m where m.tenant_id = p_tenant and m.user_id = r.user_id)))
  order by r.created_at desc;
$$;
revoke all on function public.password_reset_links(uuid) from public, anon;
grant execute on function public.password_reset_links(uuid) to authenticated;

create or replace function public.password_reset_check(p_token uuid) returns text
language sql stable security definer set search_path = '' as $$
  select u.email::text from private.password_resets r join auth.users u on u.id = r.user_id
  where r.token = p_token and r.used_at is null and r.expires_at > now();
$$;
revoke all on function public.password_reset_check(uuid) from public;
grant execute on function public.password_reset_check(uuid) to anon, authenticated;

create or replace function public.password_reset_apply(p_token uuid, p_password text) returns text
language plpgsql security definer set search_path = '' as $$
declare r private.password_resets; em text;
begin
  if length(coalesce(p_password, '')) < 8 then raise exception 'Password must be at least 8 characters.'; end if;
  select * into r from private.password_resets where token = p_token and used_at is null and expires_at > now() for update;
  if r.id is null then raise exception 'This reset link has expired or was already used. Ask for a new one.'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
  where id = r.user_id returning email into em;
  update private.password_resets set used_at = now() where user_id = r.user_id and used_at is null;
  insert into public.audit_log (tenant_id, user_id, action, entity, entity_id, detail)
  select m.tenant_id, r.user_id, 'password_reset', 'user', r.user_id, '{}'::jsonb from public.tenant_members m where m.user_id = r.user_id;
  return em;
end $$;
revoke all on function public.password_reset_apply(uuid, text) from public;
grant execute on function public.password_reset_apply(uuid, text) to anon, authenticated;

-- 2b. lost authenticator: a platform admin removes the person's TOTP factor (they set it up again at next sign-in)
create or replace function public.admin_reset_mfa(p_user uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not public.is_platform_admin() then raise exception 'Only a platform admin can reset two-factor login.'; end if;
  delete from auth.mfa_factors where user_id = p_user and factor_type = 'totp';
  get diagnostics n = row_count;
  insert into public.audit_log (tenant_id, user_id, action, entity, entity_id, detail)
  select m.tenant_id, auth.uid(), 'mfa_reset', 'user', p_user, jsonb_build_object('factors', n) from public.tenant_members m where m.user_id = p_user;
  return n;
end $$;
revoke all on function public.admin_reset_mfa(uuid) from public, anon;
grant execute on function public.admin_reset_mfa(uuid) to authenticated;
