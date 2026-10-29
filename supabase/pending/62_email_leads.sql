-- 62. Email enquiries → leads (C42, 29 Oct 2026). Applied 29 Oct (apply_migration email_enquiry_leads,
-- email_lead_note_kind, sequence_steps_wa_lang_default). The firm's own Gmail (Apps Script, lib/emailLead.js
-- appsScript) POSTs each new email to /api/email/lead/<token> with the key in x-dhandha-key; the route builds the lead
-- row (leadFromEmail) and calls email_lead. Leads use source 'website' (the source check cannot be widened without a
-- drop); notes start "Email enquiry:".

create table if not exists public.email_hooks (
  company_id uuid primary key references public.companies(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  key_hash text not null,
  own_domains text[] not null default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  last_at timestamptz, leads int not null default 0, repeats int not null default 0, skipped int not null default 0,
  last_skip text
);
alter table public.email_hooks enable row level security;
create policy email_hooks_read on public.email_hooks for select using (public.is_tenant_member(tenant_id));

create table if not exists public.email_lead_seen (
  company_id uuid not null references public.companies(id) on delete cascade,
  message_id text not null,
  lead_id uuid,
  at timestamptz not null default now(),
  primary key (company_id, message_id)
);
alter table public.email_lead_seen enable row level security;

-- Functions (see the live definitions with pg_get_functiondef):
--   email_hook_new(company) → { token, key }        admin only; key shown once, sha256 stored
--   email_hook_save(company, own_domains, enabled)   admin only
--   email_hook_domains(token, key) → text[]          the firm's own domains, only with the key
--   email_lead(token, key, mail)                     anon; checks the key; { skip } counted; message_id once;
--     ≤300 a day; existing lead (same email) → note "Wrote again by email", its playbook stops (replied), owner push;
--     else private.import_core(..., 'website', ...) + note "Came in by email", push to admins / managers / owner.
-- Notes use kind 'note' (an 'email' activity would mark the lead contacted and stop its new playbook).

-- Playbook save fix: steps other than WhatsApp were sent with wa_lang null (column is not null).
create or replace function private.sequence_step_defaults() returns trigger language plpgsql set search_path = '' as $$
begin
  new.wa_lang := coalesce(nullif(new.wa_lang, ''), 'en');
  return new;
end $$;
create trigger b_sequence_step_defaults before insert or update on public.sequence_steps for each row execute function private.sequence_step_defaults();
