-- 88 (13 Nov): bank reconciliation (owner, map item 10). Statement lines uploaded by the person (CSV / Excel), one row
-- per bank line (same line in two uploads is kept once: unique company + hash); matched to an invoice payment, a
-- deposit refund or an EMD / BG paid, or ignored with a note. Nothing is deleted.
create table if not exists public.bank_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  company_id uuid not null references public.companies(id),
  account text not null default 'Main account',
  txn_date date not null, narration text not null default '', ref text,
  debit numeric not null default 0, credit numeric not null default 0, balance numeric,
  hash text not null,
  status text not null default 'unmatched' check (status in ('unmatched','matched','ignored')),
  matched_kind text check (matched_kind in ('invoice','refund','deposit','other')), matched_id uuid, note text,
  batch text, uploaded_by uuid default auth.uid(), created_at timestamptz not null default now(),
  matched_by uuid, matched_at timestamptz,
  unique (company_id, hash)
);
create index if not exists bank_lines_company_date on public.bank_lines (company_id, txn_date desc);
alter table public.bank_lines enable row level security;
do $$ begin
  create policy bank_lines_read on public.bank_lines for select using (coalesce(public.tenant_role(tenant_id), '') in ('admin','manager'));
  create policy bank_lines_add on public.bank_lines for insert with check (coalesce(public.tenant_role(tenant_id), '') in ('admin','manager'));
  create policy bank_lines_edit on public.bank_lines for update using (coalesce(public.tenant_role(tenant_id), '') in ('admin','manager'));
exception when duplicate_object then null; end $$;
grant select, insert, update on public.bank_lines to authenticated;
