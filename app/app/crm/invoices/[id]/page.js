import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getContext, fmtDate } from "@/lib/session";
import FormState from "../../../FormState";
import SubmitButton from "@/components/SubmitButton";
import { STATUS, MODES, balance, invoiceFromQuote } from "@/lib/invoice";
import Editor from "./Editor";
import { addPayment, cancelInvoice } from "../actions";

export const metadata = { title: "Invoice" };

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default async function InvoicePage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, company, role } = await getContext();
  const isNew = id === "new";
  const [{ data: inv }, { data: c }, { data: quote }, { data: lead }, { data: pays }, { data: st }, h] = await Promise.all([
    isNew ? { data: null } : supabase.from("sales_invoices").select("*").eq("id", id).eq("company_id", company.id).maybeSingle(),
    supabase.from("companies").select("gstin, state, legal_name").eq("id", company.id).single(),
    sp?.quote ? supabase.from("quotes").select("*").eq("id", sp.quote).eq("company_id", company.id).maybeSingle() : { data: null },
    sp?.lead ? supabase.from("leads").select("id, name, contact_person, address, city, state, gstin, email, phone").eq("id", sp.lead).eq("company_id", company.id).maybeSingle() : { data: null },
    isNew ? { data: [] } : supabase.from("invoice_payments").select("*").eq("invoice_id", id).order("paid_on"),
    supabase.from("invoice_settings").select("terms").eq("company_id", company.id).maybeSingle(),
    headers(),
  ]);
  if (!isNew && !inv) notFound();
  const origin = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : `${h.get("x-forwarded-proto") || "https"}://${h.get("host")}`;
  const today = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
  const initial = inv || {
    ...(quote ? invoiceFromQuote(quote) : {
      client_name: lead?.name || "", client_contact: lead?.contact_person || "", client_address: [lead?.address, lead?.city].filter(Boolean).join(", "),
      client_gstin: lead?.gstin || "", client_state: lead?.state || "", client_email: lead?.email || "", client_phone: lead?.phone || "", lead_id: lead?.id || "",
      subject: "", lines: [{ desc: "", hsn: "", qty: 1, unit: "", rate: 0, gst: 18 }], discount: 0,
    }),
    terms: st?.terms || "Payment within the due date. Please quote the invoice number with your payment.", invoice_date: today, due_date: "", status: "draft",
  };
  const canEdit = !["viewer", "field", "telecaller"].includes(role);
  const link = inv && inv.status !== "draft" && inv.status !== "cancelled" ? `${origin}/i/${inv.token}` : null;
  const bal = inv ? balance(inv) : 0;
  const wa = link && inv.client_phone ? `https://wa.me/91${String(inv.client_phone).replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(`Dear ${inv.client_contact || inv.client_name}, please find invoice ${inv.number} for ${inr(bal)} here: ${link} — thank you.`)}` : null;

  return (
    <div className="stack">
      <div><Link href="/app/crm/invoices" className="small">← Invoices</Link>
        <div className="row between"><h1>{inv?.number ? `Invoice ${inv.number}` : isNew ? "New invoice" : "Draft invoice"}</h1>{inv && <span className={`chip ${STATUS[inv.status][0]}`}>{STATUS[inv.status][1]}</span>}</div></div>
      {quote && isNew && <div className="notice small">From quotation {quote.number} — check the lines and dates, then issue.</div>}
      {link && (
        <div className="panel stack-sm">
          <div className="row between"><strong>Total {inr(inv.totals?.total)} · received {inr(inv.paid_amount)} · balance {inr(bal)}</strong><span className="tiny faint">Due {fmtDate(inv.due_date)}{inv.viewed_at ? ` · client opened it ${fmtDate(inv.viewed_at)}` : ""}</span></div>
          <div className="small">Client link: <code style={{ wordBreak: "break-all" }}>{link}</code></div>
          <div className="row" style={{ gap: 8 }}>
            {wa && <a className="btn sm" href={wa} target="_blank" rel="noreferrer">Send on WhatsApp</a>}
            <a className="btn sm ghost" href={link} target="_blank" rel="noreferrer">Open client page</a>
          </div>
          <p className="tiny faint" style={{ margin: 0 }}>The client sees the invoice and pays by UPI or bank transfer. Reminders come to you as tasks with a ready message: 3 days before the due date, on the day, and 7 / 15 / 30 days late.</p>
        </div>
      )}
      <Editor id={inv?.id || null} initial={initial} seller={c} origin={origin} canEdit={canEdit && inv?.status !== "cancelled"} />
      {inv && ["issued", "part_paid", "paid"].includes(inv.status) && (
        <div className="grid-2" style={{ alignItems: "start" }}>
          <div className="panel">
            <h3>Payments received</h3>
            {!(pays || []).length && <p className="small muted" style={{ margin: 0 }}>None yet.</p>}
            {(pays || []).map((p) => <div key={p.id} className="row between small" style={{ padding: "4px 0" }}><span>{fmtDate(p.paid_on)} · {MODES[p.mode] || "—"}{p.reference ? ` · ${p.reference}` : ""}</span><strong>{inr(p.amount)}</strong></div>)}
          </div>
          {canEdit && inv.status !== "paid" && (
            <div className="panel">
              <h3>Record a payment</h3>
              <FormState action={addPayment} submit="Record payment">
                <input type="hidden" name="id" value={inv.id} />
                <div className="form-grid">
                  <div><label htmlFor="p-a">Amount (₹)</label><input id="p-a" name="amount" inputMode="numeric" defaultValue={bal} required /></div>
                  <div><label htmlFor="p-d">Received on</label><input id="p-d" name="paid_on" type="date" defaultValue={today} /></div>
                  <div><label htmlFor="p-m">How</label><select id="p-m" name="mode" defaultValue="upi">{Object.entries(MODES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
                  <div><label htmlFor="p-r">UTR / cheque no.</label><input id="p-r" name="reference" maxLength={120} /></div>
                </div>
              </FormState>
            </div>
          )}
        </div>
      )}
      {inv && ["admin", "manager"].includes(role) && ["draft", "issued"].includes(inv.status) && Number(inv.paid_amount) === 0 && (
        <form action={cancelInvoice}><input type="hidden" name="id" value={inv.id} /><SubmitButton className="ghost sm" confirm="Cancel this invoice? It stays on record as cancelled.">Cancel invoice</SubmitButton></form>
      )}
    </div>
  );
}
