import Link from "next/link";
import { getContext, lakh, fmtDate } from "@/lib/session";
import FormState from "../../FormState";
import { STATUS, ageing, balance, total } from "@/lib/invoice";
import { saveInvoiceSettings } from "./actions";

export const metadata = { title: "Invoices" };

export default async function Invoices({ searchParams }) {
  const sp = await searchParams;
  const { supabase, company, role } = await getContext();
  const [{ data: rows }, { data: st }] = await Promise.all([
    supabase.from("sales_invoices").select("id, number, status, client_name, invoice_date, due_date, totals, paid_amount, repeat_months, lead_id").eq("company_id", company.id).order("created_at", { ascending: false }).limit(500),
    supabase.from("invoice_settings").select("*").eq("company_id", company.id).maybeSingle(),
  ]);
  const list = rows || [];
  const a = ageing(list);
  const show = sp?.show === "all" ? list : sp?.show === "unpaid" ? list.filter((i) => ["issued", "part_paid"].includes(i.status)) : list.slice(0, 100);
  const today = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
  const lead = ["admin", "manager"].includes(role);
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Invoices</h1><p>GST tax invoices on your letterhead, a client link to pay by UPI or bank, payments received and automatic reminders. Make one from an accepted quotation, or new.</p></div>
        <Link className="btn" href="/app/crm/invoices/new">New invoice</Link></div>
      <div className="grid-3">
        <div className="panel"><div className="tiny faint">To come in</div><div style={{ fontSize: 24, fontWeight: 700 }}>{lakh(a.total)}</div><div className="tiny faint">{a.count} unpaid invoices · {lakh(a.notDue)} not yet due</div></div>
        <div className="panel"><div className="tiny faint">Late</div><div style={{ fontSize: 24, fontWeight: 700, color: a.total - a.notDue > 0 ? "var(--blood)" : undefined }}>{lakh(a.total - a.notDue)}</div><div className="tiny faint">1–30 days {lakh(a.d0_30)} · 31–60 {lakh(a.d31_60)} · 61–90 {lakh(a.d61_90)} · 90+ {lakh(a.d90)}</div></div>
        <div className="panel"><div className="tiny faint">Repeating</div><div style={{ fontSize: 24, fontWeight: 700 }}>{list.filter((i) => i.repeat_months).length}</div><div className="tiny faint">retainers / AMCs issued by themselves</div></div>
      </div>
      <nav className="row" style={{ gap: 6 }}>{[["", "Latest"], ["unpaid", "Unpaid"], ["all", "All"]].map(([k, l]) => <Link key={k} href={`/app/crm/invoices${k ? `?show=${k}` : ""}`} className={`btn sm ${(sp?.show || "") === k ? "" : "ghost"}`}>{l}</Link>)}</nav>
      <div className="panel flush table-wrap">
        <table>
          <thead><tr><th>Invoice</th><th>Client</th><th>Total</th><th>Balance</th><th>Due</th><th>Status</th></tr></thead>
          <tbody>
            {!show.length && <tr><td colSpan={6} className="muted small">No invoices yet.</td></tr>}
            {show.map((i) => { const late = ["issued", "part_paid"].includes(i.status) && i.due_date && i.due_date < today; return (
              <tr key={i.id}>
                <td className="small"><Link href={`/app/crm/invoices/${i.id}`}>{i.number || "Draft"}</Link>{i.repeat_months ? <div className="tiny faint">repeats every {i.repeat_months === 1 ? "month" : `${i.repeat_months} months`}</div> : null}</td>
                <td className="small">{i.client_name}<div className="tiny faint">{fmtDate(i.invoice_date)}</div></td>
                <td className="num small">{lakh(total(i))}</td>
                <td className="num small">{["issued", "part_paid"].includes(i.status) ? lakh(balance(i)) : "—"}</td>
                <td className="small" style={{ color: late ? "var(--blood)" : undefined }}>{i.due_date ? fmtDate(i.due_date) : "—"}</td>
                <td><span className={`chip ${late ? "bad" : STATUS[i.status][0]}`}>{late ? "Late" : STATUS[i.status][1]}</span></td>
              </tr>); })}
          </tbody>
        </table>
      </div>
      {lead && (
        <details className="panel" open={!st}>
          <summary><strong>Invoice settings</strong> <span className="small muted">— UPI, due days, reminders</span></summary>
          <div style={{ marginTop: 10, maxWidth: 560 }}>
            <FormState action={saveInvoiceSettings}>
              <div className="form-grid">
                <div><label htmlFor="s-u">UPI ID for payments</label><input id="s-u" name="upi_id" defaultValue={st?.upi_id || ""} placeholder="yourfirm@okicici" /></div>
                <div><label htmlFor="s-d">Payment due in (days)</label><input id="s-d" name="due_days" type="number" min={0} max={120} defaultValue={st?.due_days ?? 15} /></div>
              </div>
              <label className="row small" style={{ gap: 8 }}><input type="checkbox" name="reminders" defaultChecked={st ? st.reminders : true} style={{ width: "auto" }} />Remind us to follow up unpaid invoices (tasks + phone alert)</label>
              <div><label htmlFor="s-t">Default terms</label><textarea id="s-t" name="terms" rows={2} maxLength={2000} defaultValue={st?.terms || ""} /></div>
              <p className="tiny faint" style={{ margin: 0 }}>Bank details come from your Company profile in the Vault. The client page shows a “Pay by UPI” button that opens their UPI app with the amount filled in.</p>
            </FormState>
          </div>
        </details>
      )}
    </div>
  );
}
