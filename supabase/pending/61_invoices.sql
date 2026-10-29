create table if not exists public.sales_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  company_id uuid not null references public.companies(id),
  lead_id uuid references public.leads(id),
  quote_id uuid references public.quotes(id),
  parent_id uuid references public.sales_invoices(id),
  number text,
  invoice_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  due_date date,
  client_name text not null, client_contact text, client_address text, client_gstin text, client_state text, client_email text, client_phone text,
  subject text, lines jsonb not null default '[]', discount numeric(14,2) not null default 0, totals jsonb not null default '{}',
  terms text, status text not null default 'draft' check (status in ('draft','issued','part_paid','paid','cancelled')),
  paid_amount numeric(14,2) not null default 0,
  token uuid not null default gen_random_uuid() unique,
  repeat_months int check (repeat_months between 1 and 12), next_on date,
  reminders jsonb not null default '{}',
  issued_at timestamptz, viewed_at timestamptz, paid_at timestamptz,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists sales_invoices_number on public.sales_invoices(company_id, number) where number is not null;
create index if not exists sales_invoices_company on public.sales_invoices(company_id, status, due_date);
alter table public.sales_invoices enable row level security;
create policy "invoices: members read" on public.sales_invoices for select to authenticated using (public.is_tenant_member(tenant_id));

create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.sales_invoices(id),
  tenant_id uuid not null references public.tenants(id),
  amount numeric(14,2) not null check (amount > 0),
  paid_on date not null default (now() at time zone 'Asia/Kolkata')::date,
  mode text check (mode in ('upi','neft','cheque','cash','card','other')),
  reference text check (length(reference) <= 120),
  created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create index if not exists invoice_payments_invoice on public.invoice_payments(invoice_id);
alter table public.invoice_payments enable row level security;
create policy "invoice payments: members read" on public.invoice_payments for select to authenticated using (public.is_tenant_member(tenant_id));

create table if not exists public.invoice_settings (
  company_id uuid primary key references public.companies(id),
  tenant_id uuid not null references public.tenants(id),
  upi_id text check (upi_id ~ '^[a-zA-Z0-9._-]{2,64}@[a-zA-Z0-9.-]{2,64}$'),
  due_days int not null default 15 check (due_days between 0 and 120),
  reminders boolean not null default true,
  terms text check (length(terms) <= 2000),
  updated_at timestamptz not null default now()
);
alter table public.invoice_settings enable row level security;
create policy "invoice settings: members read" on public.invoice_settings for select to authenticated using (public.is_tenant_member(tenant_id));

create or replace function private.next_invoice_number(p_company uuid, p_date date)
returns text language plpgsql security definer set search_path = '' as $$
declare fy text; n int; d date := coalesce(p_date, (now() at time zone 'Asia/Kolkata')::date);
begin
  fy := case when extract(month from d) >= 4 then extract(year from d)::int || '-' || right((extract(year from d)::int + 1)::text, 2)
             else (extract(year from d)::int - 1) || '-' || right(extract(year from d)::int::text, 2) end;
  perform pg_advisory_xact_lock(hashtext('invoice:' || p_company::text));
  select coalesce(max(split_part(number, '/', 3)::int), 0) + 1 into n from public.sales_invoices where company_id = p_company and number like 'INV/' || fy || '/%';
  return 'INV/' || fy || '/' || lpad(n::text, 4, '0');
end $$;

create or replace function public.invoice_settings_save(p_company uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_tenant uuid;
begin
  select tenant_id into v_tenant from companies where id = p_company;
  if v_tenant is null or coalesce(public.tenant_role(v_tenant), '') not in ('admin','manager') then raise exception 'Only admins and managers change invoice settings'; end if;
  insert into invoice_settings (company_id, tenant_id, upi_id, due_days, reminders, terms)
  values (p_company, v_tenant, nullif(trim(p->>'upi_id'), ''), coalesce(nullif(p->>'due_days','')::int, 15), coalesce((p->>'reminders')::boolean, true), left(nullif(trim(p->>'terms'),''), 2000))
  on conflict (company_id) do update set upi_id = excluded.upi_id, due_days = excluded.due_days, reminders = excluded.reminders, terms = excluded.terms, updated_at = now();
end $$;

-- a draft can be edited freely; an issued invoice is fixed (GST) — only due date and repeat can change
create or replace function public.invoice_save(p_id uuid, p_company uuid, p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_id uuid; inv sales_invoices;
begin
  select tenant_id into v_tenant from companies where id = p_company;
  if v_tenant is null or not public.can_write(v_tenant) or coalesce(public.tenant_role(v_tenant), '') in ('viewer','field','telecaller') then raise exception 'not allowed'; end if;
  if length(trim(coalesce(p->>'client_name', ''))) < 2 then raise exception 'Enter the client''s name'; end if;
  if p_id is null then
    insert into sales_invoices (tenant_id, company_id, client_name, created_by, quote_id) values (v_tenant, p_company, trim(p->>'client_name'), auth.uid(), nullif(p->>'quote_id','')::uuid) returning id into v_id;
  else
    select * into inv from sales_invoices where id = p_id and company_id = p_company;
    if inv.id is null then raise exception 'not found'; end if;
    v_id := p_id;
    if inv.status <> 'draft' then
      update sales_invoices set due_date = coalesce(nullif(p->>'due_date','')::date, due_date), repeat_months = nullif(p->>'repeat_months','')::int,
        next_on = case when nullif(p->>'repeat_months','') is null then null else coalesce(next_on, (invoice_date + make_interval(months => (p->>'repeat_months')::int))::date) end, updated_at = now()
      where id = v_id;
      return v_id;
    end if;
  end if;
  update sales_invoices set
    lead_id = nullif(p->>'lead_id', '')::uuid, client_name = left(trim(p->>'client_name'), 200), client_contact = left(nullif(trim(p->>'client_contact'), ''), 120),
    client_address = left(nullif(trim(p->>'client_address'), ''), 500), client_gstin = upper(left(nullif(trim(p->>'client_gstin'), ''), 15)),
    client_state = left(nullif(trim(p->>'client_state'), ''), 60), client_email = left(nullif(trim(p->>'client_email'), ''), 200),
    client_phone = left(nullif(trim(p->>'client_phone'), ''), 20), subject = left(nullif(trim(p->>'subject'), ''), 300),
    lines = coalesce(p->'lines', '[]'), discount = greatest(0, coalesce(nullif(p->>'discount', '')::numeric, 0)), totals = coalesce(p->'totals', '{}'),
    terms = left(nullif(trim(p->>'terms'), ''), 4000), invoice_date = coalesce(nullif(p->>'invoice_date','')::date, invoice_date),
    due_date = nullif(p->>'due_date','')::date, repeat_months = nullif(p->>'repeat_months','')::int, updated_at = now()
  where id = v_id;
  return v_id;
end $$;

create or replace function public.invoice_issue(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv sales_invoices;
begin
  select * into inv from sales_invoices where id = p_id;
  if inv.id is null or not public.can_write(inv.tenant_id) or coalesce(public.tenant_role(inv.tenant_id), '') in ('viewer','field','telecaller') then raise exception 'not allowed'; end if;
  if inv.status <> 'draft' then return inv.token; end if;
  if coalesce((inv.totals->>'total')::numeric, 0) <= 0 then raise exception 'Add at least one line'; end if;
  update sales_invoices set number = private.next_invoice_number(company_id, invoice_date), status = 'issued', issued_at = now(),
    due_date = coalesce(due_date, invoice_date + coalesce((select due_days from invoice_settings s where s.company_id = inv.company_id), 15)),
    next_on = case when repeat_months is null then null else (invoice_date + make_interval(months => repeat_months))::date end, updated_at = now()
  where id = p_id;
  if inv.lead_id is not null then
    insert into crm_activities (tenant_id, company_id, lead_id, kind, body, created_by)
    select inv.tenant_id, inv.company_id, inv.lead_id, 'note', 'Invoice ' || number || ' issued: ₹' || to_char((totals->>'total')::numeric, 'FM99,99,99,999'), auth.uid() from sales_invoices where id = p_id;
  end if;
  return inv.token;
end $$;

create or replace function public.invoice_cancel(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update sales_invoices set status = 'cancelled', next_on = null, updated_at = now()
  where id = p_id and paid_amount = 0 and status in ('draft','issued') and coalesce(public.tenant_role(tenant_id), '') in ('admin','manager');
  if not found then raise exception 'Only an unpaid invoice can be cancelled, by an admin or manager (issue a credit note for paid ones)'; end if;
end $$;

create or replace function public.invoice_payment_add(p_invoice uuid, p_amount numeric, p_paid_on date, p_mode text, p_ref text)
returns void language plpgsql security definer set search_path = public as $$
declare inv sales_invoices; v_paid numeric; v_total numeric;
begin
  select * into inv from sales_invoices where id = p_invoice;
  if inv.id is null or not public.can_write(inv.tenant_id) or coalesce(public.tenant_role(inv.tenant_id), '') in ('viewer','field','telecaller') then raise exception 'not allowed'; end if;
  if inv.status not in ('issued','part_paid') then raise exception 'Issue the invoice first'; end if;
  if coalesce(p_amount, 0) <= 0 then raise exception 'Enter the amount received'; end if;
  insert into invoice_payments (invoice_id, tenant_id, amount, paid_on, mode, reference, created_by) values (p_invoice, inv.tenant_id, p_amount, coalesce(p_paid_on, current_date), nullif(p_mode,''), left(p_ref,120), auth.uid());
  v_paid := inv.paid_amount + p_amount; v_total := coalesce((inv.totals->>'total')::numeric, 0);
  update sales_invoices set paid_amount = v_paid, status = case when v_paid >= v_total then 'paid' else 'part_paid' end,
    paid_at = case when v_paid >= v_total then now() else paid_at end, updated_at = now() where id = p_invoice;
  if inv.lead_id is not null then
    insert into crm_activities (tenant_id, company_id, lead_id, kind, body, created_by)
    values (inv.tenant_id, inv.company_id, inv.lead_id, 'note', 'Payment received ₹' || to_char(p_amount, 'FM99,99,99,999') || ' against ' || inv.number || case when v_paid >= v_total then ' — fully paid' else ' (balance ₹' || to_char(v_total - v_paid, 'FM99,99,99,999') || ')' end, auth.uid());
  end if;
end $$;

-- public: the client's view of an issued invoice (no login), with the seller's payment details
create or replace function public.invoice_view(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare inv sales_invoices; r jsonb;
begin
  select * into inv from sales_invoices where token = p_token and status in ('issued','part_paid','paid');
  if not found then return null; end if;
  if inv.viewed_at is null then update sales_invoices set viewed_at = now() where id = inv.id; end if;
  select jsonb_build_object('number', inv.number, 'invoice_date', inv.invoice_date, 'due_date', inv.due_date, 'status', inv.status, 'paid_amount', inv.paid_amount,
    'client_name', inv.client_name, 'client_address', inv.client_address, 'client_gstin', inv.client_gstin, 'subject', inv.subject, 'totals', inv.totals, 'terms', inv.terms,
    'seller', jsonb_build_object('name', c.legal_name, 'gstin', c.gstin, 'address', concat_ws(', ', c.registered_address, c.city, c.state), 'bank_name', c.bank_name, 'bank_account', c.bank_account, 'bank_ifsc', c.bank_ifsc, 'phone', c.phone, 'email', c.email),
    'upi_id', (select upi_id from invoice_settings s where s.company_id = inv.company_id))
  into r from companies c where c.id = inv.company_id;
  return r;
end $$;

-- daily: monthly / repeating invoices are issued, and unpaid ones get a reminder task + phone alert (3 days before due,
-- on the due date, 7 / 15 / 30 days late), each once
create or replace function private.invoice_daily()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare inv record; v_today date := (now() at time zone 'Asia/Kolkata')::date; v_new uuid; n_rep int := 0; n_rem int := 0; v_tag text; v_days int; v_owner uuid; v_bal numeric; v_link text; u uuid;
begin
  for inv in select * from public.sales_invoices where repeat_months is not null and next_on <= v_today and status in ('issued','part_paid','paid') loop
    insert into public.sales_invoices (tenant_id, company_id, lead_id, parent_id, invoice_date, client_name, client_contact, client_address, client_gstin, client_state, client_email, client_phone,
      subject, lines, discount, totals, terms, created_by)
    values (inv.tenant_id, inv.company_id, inv.lead_id, inv.id, inv.next_on, inv.client_name, inv.client_contact, inv.client_address, inv.client_gstin, inv.client_state, inv.client_email, inv.client_phone,
      inv.subject, inv.lines, inv.discount, inv.totals, inv.terms, inv.created_by) returning id into v_new;
    update public.sales_invoices set number = private.next_invoice_number(company_id, invoice_date), status = 'issued', issued_at = now(),
      due_date = invoice_date + coalesce((select due_days from public.invoice_settings s where s.company_id = inv.company_id), 15) where id = v_new;
    update public.sales_invoices set repeat_months = null, next_on = null where id = inv.id;
    update public.sales_invoices set repeat_months = inv.repeat_months, next_on = (inv.next_on + make_interval(months => inv.repeat_months))::date where id = v_new;
    n_rep := n_rep + 1;
  end loop;

  select value into v_link from private.app_config where key = 'app_url';
  for inv in select i.* from public.sales_invoices i left join public.invoice_settings s on s.company_id = i.company_id
             where i.status in ('issued','part_paid') and i.due_date is not null and coalesce(s.reminders, true) loop
    v_days := v_today - inv.due_date; v_tag := null;
    if v_days = -3 then v_tag := 'd-3'; elsif v_days = 0 then v_tag := 'd0'; elsif v_days in (7, 15, 30) then v_tag := 'late' || v_days; end if;
    if v_tag is null or inv.reminders ? v_tag then continue; end if;
    v_bal := coalesce((inv.totals->>'total')::numeric, 0) - inv.paid_amount;
    v_owner := coalesce((select owner_id from public.leads where id = inv.lead_id), inv.created_by);
    insert into public.tasks (tenant_id, company_id, title, details, assigned_to, due_at, priority, status, link_type, link_id, link_label)
    values (inv.tenant_id, inv.company_id, left(case when v_days < 0 then 'Payment due in 3 days: ' when v_days = 0 then 'Payment due today: ' else 'Payment ' || v_days || ' days late: ' end || inv.client_name || ' · ' || inv.number, 200),
      'Send this on WhatsApp / email:' || chr(10) || 'Dear ' || coalesce(inv.client_contact, inv.client_name) || ', a gentle reminder that invoice ' || inv.number || ' for ₹' || to_char(v_bal, 'FM99,99,99,999') ||
      case when v_days <= 0 then ' is due on ' || to_char(inv.due_date, 'DD Mon YYYY') else ' was due on ' || to_char(inv.due_date, 'DD Mon YYYY') end || '. You can view and pay it here: ' || rtrim(coalesce(v_link, ''), '/') || '/i/' || inv.token || ' . Thank you!',
      v_owner, now(), case when v_days >= 15 then 'high' else 'normal' end, 'todo', case when inv.lead_id is not null then 'lead' else null end, inv.lead_id, inv.client_name);
    if v_owner is not null then perform private.push_to(v_owner, case when v_days > 0 then 'Payment late: ' else 'Payment due: ' end || left(inv.client_name, 40), inv.number || ' · ₹' || to_char(v_bal, 'FM99,99,99,999'), '/app/crm/invoices/' || inv.id, 'inv:' || inv.id || ':' || v_tag); end if;
    update public.sales_invoices set reminders = reminders || jsonb_build_object(v_tag, now()) where id = inv.id;
    n_rem := n_rem + 1;
  end loop;
  return jsonb_build_object('repeated', n_rep, 'reminders', n_rem);
end $$;
select cron.schedule('invoice_daily', '57 3 * * *', 'select private.invoice_daily()');

revoke all on function public.invoice_settings_save(uuid,jsonb), public.invoice_save(uuid,uuid,jsonb), public.invoice_issue(uuid), public.invoice_cancel(uuid),
  public.invoice_payment_add(uuid,numeric,date,text,text) from public, anon;
grant execute on function public.invoice_settings_save(uuid,jsonb), public.invoice_save(uuid,uuid,jsonb), public.invoice_issue(uuid), public.invoice_cancel(uuid),
  public.invoice_payment_add(uuid,numeric,date,text,text) to authenticated;
grant execute on function public.invoice_view(uuid) to anon, authenticated;
