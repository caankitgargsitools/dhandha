-- 84 (11 Nov): customer score (owner, map item 6). One row per customer (a lead with a won deal) with what the health
-- score needs; the score itself is worked out in lib/customerScore.js (tested).
create or replace function public.customer_health(p_company uuid) returns table (
  lead_id uuid, name text, contact_person text, phone text, city text, owner_id uuid,
  won_deals int, won_value numeric, first_won timestamptz, last_won timestamptz, open_deals int, lost_after_win int,
  last_touch timestamptz, touches90 int, invoiced numeric, paid numeric, overdue numeric, overdue_count int,
  late_paid int, referrals int, review_clicked boolean, renews_on date)
language sql stable security definer set search_path = '' as $$
  with c as (
    select d.lead_id, count(*) filter (where d.stage = 'won')::int won_deals, coalesce(sum(d.value_inr) filter (where d.stage = 'won'), 0) won_value,
      min(d.closed_at) filter (where d.stage = 'won') first_won, max(d.closed_at) filter (where d.stage = 'won') last_won,
      count(*) filter (where d.stage not in ('won', 'lost'))::int open_deals, min(d.renews_on) filter (where d.renews_on >= current_date) renews_on
    from public.deals d where d.company_id = p_company and d.lead_id is not null group by d.lead_id having count(*) filter (where d.stage = 'won') > 0)
  select l.id, l.name, l.contact_person, l.phone, l.city, l.owner_id,
    c.won_deals, c.won_value, c.first_won, c.last_won, c.open_deals,
    (select count(*)::int from public.deals d where d.lead_id = l.id and d.stage = 'lost' and d.closed_at > c.first_won),
    greatest(l.last_contacted_at, (select max(a.created_at) from public.crm_activities a where a.lead_id = l.id)),
    (select count(*)::int from public.crm_activities a where a.lead_id = l.id and a.created_at > now() - interval '90 days'),
    coalesce(i.invoiced, 0), coalesce(i.paid, 0), coalesce(i.overdue, 0), coalesce(i.overdue_count, 0), coalesce(i.late_paid, 0),
    coalesce((select sum(r.referrals)::int from public.referral_links r where r.lead_id = l.id), 0)
      + (select count(*)::int from public.leads x where x.referred_by = l.id),
    exists (select 1 from public.review_requests q where q.lead_id = l.id and q.clicked_at is not null),
    c.renews_on
  from c join public.leads l on l.id = c.lead_id
  left join lateral (
    select sum(coalesce((s.totals->>'total')::numeric, 0)) filter (where s.status <> 'draft' and s.status <> 'cancelled') invoiced,
      sum(coalesce(s.paid_amount, 0)) paid,
      sum(coalesce((s.totals->>'total')::numeric, 0) - coalesce(s.paid_amount, 0)) filter (where s.status in ('issued', 'part_paid', 'overdue', 'sent') and s.due_date < current_date) overdue,
      count(*) filter (where s.status in ('issued', 'part_paid', 'overdue', 'sent') and s.due_date < current_date)::int overdue_count,
      count(*) filter (where s.status = 'paid' and s.paid_at::date > s.due_date)::int late_paid
    from public.sales_invoices s where s.company_id = p_company and s.lead_id = l.id) i on true
  where l.company_id = p_company and public.is_tenant_member(l.tenant_id)
    and (public.sees_all_leads(l.tenant_id) or l.owner_id = auth.uid());
$$;
revoke all on function public.customer_health(uuid) from public, anon;
grant execute on function public.customer_health(uuid) to authenticated;
