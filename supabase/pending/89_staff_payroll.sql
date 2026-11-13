-- 89 (13 Nov): staff & payroll (owner, map item 10 part 2). A staff register and a monthly pay sheet with PF / ESI /
-- professional tax / TDS / advances worked out by lib/payroll.js; payslips and a bank-transfer sheet. Personal details
-- (PAN, UAN, ESIC no., bank) are seen by workspace admins only. People leave (left_on), rows are never deleted.
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  company_id uuid not null references public.companies(id),
  name text not null, designation text, phone text, email text, joined_on date, left_on date,
  gross numeric not null default 0 check (gross >= 0), basic_pct numeric not null default 50 check (basic_pct between 0 and 100),
  pf boolean not null default true, esi boolean not null default true, pt numeric not null default 0, tds numeric not null default 0,
  pan text, uan text, esic_no text, bank_name text, bank_account text, ifsc text,
  user_id uuid, created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists staff_company on public.staff (company_id, name);
alter table public.staff enable row level security;
do $$ begin
  create policy staff_admin on public.staff for select using (coalesce(public.tenant_role(tenant_id), '') = 'admin');
  create policy staff_add on public.staff for insert with check (coalesce(public.tenant_role(tenant_id), '') = 'admin');
  create policy staff_edit on public.staff for update using (coalesce(public.tenant_role(tenant_id), '') = 'admin');
exception when duplicate_object then null; end $$;
grant select, insert, update on public.staff to authenticated;

create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  company_id uuid not null references public.companies(id),
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  status text not null default 'draft' check (status in ('draft','final')),
  lines jsonb not null default '[]', totals jsonb not null default '{}',
  created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  finalised_at timestamptz, finalised_by uuid,
  unique (company_id, month)
);
alter table public.payroll_runs enable row level security;
do $$ begin
  create policy payroll_admin on public.payroll_runs for select using (coalesce(public.tenant_role(tenant_id), '') = 'admin');
  create policy payroll_add on public.payroll_runs for insert with check (coalesce(public.tenant_role(tenant_id), '') = 'admin');
  create policy payroll_edit on public.payroll_runs for update using (coalesce(public.tenant_role(tenant_id), '') = 'admin' and status = 'draft');
exception when duplicate_object then null; end $$;
grant select, insert, update on public.payroll_runs to authenticated;
