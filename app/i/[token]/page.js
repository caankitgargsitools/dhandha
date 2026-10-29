import { anonClient } from "@/lib/supabase/anon";
import { upiLink, balance } from "@/lib/invoice";
import PrintButton from "./PrintButton";

export const metadata = { title: "Invoice", robots: { index: false } };
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const day = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }) : "");

// The client's view of a tax invoice (no login): see it, pay by UPI or bank transfer, print / save as PDF.
export default async function ClientInvoice({ params }) {
  const { token } = await params;
  const { data: v } = /^[0-9a-f-]{36}$/i.test(token) ? await anonClient().rpc("invoice_view", { p_token: token }) : { data: null };
  if (!v) return <main style={{ padding: "40px 16px", display: "grid", placeItems: "center" }}><div className="panel"><h1 style={{ fontSize: 22 }}>Link not valid</h1></div></main>;
  const t = v.totals || {}, s = v.seller || {};
  const bal = balance(v);
  const upi = bal > 0 ? upiLink({ upi: v.upi_id, name: s.name, amount: bal, note: v.number }) : null;
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "start center", padding: "32px 16px" }}>
      <div className="panel stack" style={{ maxWidth: 820, width: "100%" }}>
        <div className="row between" style={{ alignItems: "flex-start" }}>
          <div><h2 style={{ margin: 0 }}>{s.name}</h2><div className="small muted">{s.address}{s.gstin ? ` · GSTIN ${s.gstin}` : ""}</div></div>
          <div style={{ textAlign: "right" }}><div className="tiny faint">TAX INVOICE</div><strong>{v.number}</strong><div className="small muted">{day(v.invoice_date)}</div></div>
        </div>
        <div className="row between" style={{ flexWrap: "wrap", gap: 12 }}>
          <div className="small"><div className="tiny faint">Bill to</div><strong>{v.client_name}</strong>{v.client_address ? <div>{v.client_address}</div> : null}{v.client_gstin ? <div>GSTIN {v.client_gstin}</div> : null}</div>
          <div className="small" style={{ textAlign: "right" }}>{v.due_date && <div>Due by <strong>{day(v.due_date)}</strong></div>}<div>{v.status === "paid" ? <span className="chip ok">Paid — thank you</span> : <>Balance due <strong>{inr(bal)}</strong></>}</div></div>
        </div>
        {v.subject && <p style={{ margin: 0 }}><strong>Subject:</strong> {v.subject}</p>}
        <div className="table-wrap"><table>
          <thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>GST</th><th>Amount</th></tr></thead>
          <tbody>{(t.items || []).map((l, i) => <tr key={i}><td>{i + 1}</td><td>{l.desc}{l.hsn ? <div className="tiny faint">HSN/SAC {l.hsn}</div> : null}</td><td>{l.qty} {l.unit}</td><td>{inr(l.rate)}</td><td>{l.gst}%</td><td>{inr(l.amount)}</td></tr>)}</tbody>
        </table></div>
        <table className="small" style={{ maxWidth: 360, marginLeft: "auto" }}><tbody>
          <tr><td>Sub-total</td><td style={{ textAlign: "right" }}>{inr(t.subtotal)}</td></tr>
          {t.discount > 0 && <tr><td>Discount</td><td style={{ textAlign: "right" }}>− {inr(t.discount)}</td></tr>}
          {t.local ? <><tr><td>CGST</td><td style={{ textAlign: "right" }}>{inr(t.cgst)}</td></tr><tr><td>SGST</td><td style={{ textAlign: "right" }}>{inr(t.sgst)}</td></tr></> : <tr><td>IGST</td><td style={{ textAlign: "right" }}>{inr(t.igst)}</td></tr>}
          {t.round_off ? <tr><td>Round off</td><td style={{ textAlign: "right" }}>{inr(t.round_off)}</td></tr> : null}
          <tr><td><strong>Total</strong></td><td style={{ textAlign: "right" }}><strong>{inr(t.total)}</strong></td></tr>
          {Number(v.paid_amount) > 0 && <tr><td>Received</td><td style={{ textAlign: "right" }}>− {inr(v.paid_amount)}</td></tr>}
        </tbody></table>
        <p className="small" style={{ margin: 0 }}>Amount in words: {t.words}</p>
        {bal > 0 && (
          <div className="panel stack-sm" style={{ margin: 0 }}>
            <strong>Pay {inr(bal)}</strong>
            {upi && <div><a className="btn" href={upi}>Pay by UPI</a> <span className="tiny faint">opens your UPI app with the amount filled in · UPI ID {v.upi_id}</span></div>}
            {s.bank_account && <div className="small">Bank transfer: {s.bank_name} · A/c {s.bank_account} · IFSC {s.bank_ifsc} · in the name of {s.name}</div>}
            <div className="tiny faint">Please quote {v.number} with your payment.{s.phone ? ` Questions: ${s.phone}` : ""}</div>
          </div>
        )}
        {v.terms && <div className="small" style={{ whiteSpace: "pre-wrap" }}><strong>Terms</strong><br />{v.terms}</div>}
        <div className="row between"><span className="tiny faint">Sent with Dhandha. This is a computer-generated invoice.</span><PrintButton /></div>
      </div>
    </main>
  );
}
