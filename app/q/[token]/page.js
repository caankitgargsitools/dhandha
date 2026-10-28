import { anonClient } from "@/lib/supabase/anon";
import Respond from "./Respond";

export const metadata = { title: "Quotation", robots: { index: false } };
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const day = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }) : "");

// The client's view of a quotation (no login): read it, accept or decline, print.
export default async function ClientQuote({ params }) {
  const { token } = await params;
  const { data: q } = /^[0-9a-f-]{36}$/i.test(token) ? await anonClient().rpc("quote_view", { p_token: token }) : { data: null };
  if (!q) return <main style={{ padding: "40px 16px", display: "grid", placeItems: "center" }}><div className="panel"><h1 style={{ fontSize: 22 }}>Link not valid</h1></div></main>;
  const t = q.totals || {};
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "start center", padding: "32px 16px" }}>
      <div className="panel stack" style={{ maxWidth: 820, width: "100%" }}>
        <div>
          <h2 style={{ margin: 0 }}>{q.seller.name}</h2>
          <div className="small muted">{q.seller.address}{q.seller.gstin ? ` · GSTIN ${q.seller.gstin}` : ""}</div>
        </div>
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <div><div className="tiny faint">Quotation</div><strong>{q.number}</strong>{q.date ? <span className="small muted"> · {day(q.date)}</span> : null}</div>
          {q.valid_until && <div className="small muted">Valid until {day(q.valid_until)}</div>}
        </div>
        <div className="small"><div className="tiny faint">To</div><strong>{q.client_name}</strong>{q.client_contact ? <div>Kind attn: {q.client_contact}</div> : null}{q.client_address ? <div>{q.client_address}</div> : null}{q.client_gstin ? <div>GSTIN {q.client_gstin}</div> : null}</div>
        {q.subject && <p style={{ margin: 0 }}><strong>Subject:</strong> {q.subject}</p>}
        <div className="table-wrap"><table>
          <thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>GST</th><th>Amount</th></tr></thead>
          <tbody>{(t.items || []).map((l, i) => <tr key={i}><td>{i + 1}</td><td>{l.desc}{l.hsn ? <div className="tiny faint">HSN/SAC {l.hsn}</div> : null}</td><td>{l.qty} {l.unit}</td><td>{inr(l.rate)}</td><td>{l.gst}%</td><td>{inr(l.amount)}</td></tr>)}</tbody>
        </table></div>
        <table className="small" style={{ maxWidth: 360, marginLeft: "auto" }}><tbody>
          <tr><td>Sub-total</td><td style={{ textAlign: "right" }}>{inr(t.subtotal)}</td></tr>
          {t.discount > 0 && <tr><td>Discount</td><td style={{ textAlign: "right" }}>− {inr(t.discount)}</td></tr>}
          {t.local ? <><tr><td>CGST</td><td style={{ textAlign: "right" }}>{inr(t.cgst)}</td></tr><tr><td>SGST</td><td style={{ textAlign: "right" }}>{inr(t.sgst)}</td></tr></> : <tr><td>IGST</td><td style={{ textAlign: "right" }}>{inr(t.igst)}</td></tr>}
          <tr><td><strong>Total</strong></td><td style={{ textAlign: "right" }}><strong>{inr(t.total)}</strong></td></tr>
        </tbody></table>
        <p className="small" style={{ margin: 0 }}>Amount in words: {t.words}</p>
        {q.terms && <div className="small" style={{ whiteSpace: "pre-wrap" }}><strong>Terms and conditions</strong><br />{q.terms}</div>}
        {q.seller.bank && <p className="small muted" style={{ margin: 0 }}>Bank: {q.seller.bank.name} · A/c {q.seller.bank.account} · IFSC {q.seller.bank.ifsc}</p>}
        {q.status === "sent" ? <Respond token={token} />
          : <div className="notice" style={{ display: "block" }}>{q.status === "accepted" ? `Accepted by ${q.responded_name} on ${day(q.responded_at)}.` : q.status === "declined" ? `Declined by ${q.responded_name}.` : "This quotation has expired — please ask for a fresh one."}</div>}
        <p className="tiny faint" style={{ margin: 0 }}>Sent with Dhandha.</p>
      </div>
    </main>
  );
}
