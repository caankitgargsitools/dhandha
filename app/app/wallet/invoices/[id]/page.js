import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext, inr, fmtDate } from "@/lib/session";
import { rupeesInWords } from "@/lib/billing";
import PrintButton from "@/components/PrintButton";

// GST tax invoice, printed from the browser. Both parties are snapshotted on the invoice row at issue time.
export default async function Invoice({ params }) {
  const { id } = await params;
  const { supabase, tenant } = await getContext();
  const { data: v } = await supabase.from("invoices").select("*").eq("id", id).eq("tenant_id", tenant.id).maybeSingle();
  if (!v) notFound();
  const intra = Number(v.igst) === 0;
  const half = Number(v.gst_rate || 18) / 2;
  const cell = { padding: "8px 10px", border: "1px solid var(--line)" };

  return (
    <div className="stack">
      <div className="row between no-print"><Link href="/app/wallet" className="small">Credits & plan</Link><PrintButton /></div>
      <div className="panel invoice" style={{ maxWidth: 820 }}>
        <div className="row between" style={{ alignItems: "flex-start" }}>
          <div>
            <h2 style={{ margin: 0 }}>{v.seller_name || "Dhandha"}</h2>
            <div className="small" style={{ whiteSpace: "pre-wrap" }}>{v.seller_address}</div>
            <div className="small">GSTIN: <strong>{v.seller_gstin}</strong> · State: {v.seller_state}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="kpi-label">Tax invoice</div>
            <div><strong>{v.invoice_no}</strong></div>
            <div className="small">Date: {fmtDate(v.issued_at)}</div>
            {v.razorpay_payment_id && <div className="tiny faint">Payment ref {v.razorpay_payment_id}</div>}
          </div>
        </div>
        <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "16px 0" }} />
        <div className="small">
          <div className="kpi-label">Billed to</div>
          <strong>{v.customer_name}</strong>
          {v.customer_address && <div>{v.customer_address}</div>}
          <div>GSTIN: {v.customer_gstin || "Unregistered"} · Place of supply: {v.place_of_supply}</div>
        </div>
        <table style={{ marginTop: 16, borderCollapse: "collapse" }}>
          <thead><tr><th style={cell}>Description</th><th style={cell}>SAC</th><th style={{ ...cell, textAlign: "right" }}>Taxable value (₹)</th></tr></thead>
          <tbody>
            <tr><td style={cell}>{v.description}</td><td style={cell}>{v.sac_code || "—"}</td><td style={{ ...cell, textAlign: "right" }}>{inr(v.taxable_value)}</td></tr>
            {intra ? <>
              <tr><td style={cell} colSpan={2}>CGST @ {half}%</td><td style={{ ...cell, textAlign: "right" }}>{inr(v.cgst)}</td></tr>
              <tr><td style={cell} colSpan={2}>SGST @ {half}%</td><td style={{ ...cell, textAlign: "right" }}>{inr(v.sgst)}</td></tr>
            </> : <tr><td style={cell} colSpan={2}>IGST @ {Number(v.gst_rate || 18)}%</td><td style={{ ...cell, textAlign: "right" }}>{inr(v.igst)}</td></tr>}
            <tr><td style={cell} colSpan={2}><strong>Total</strong></td><td style={{ ...cell, textAlign: "right" }}><strong>{inr(v.total)}</strong></td></tr>
          </tbody>
        </table>
        <p className="small" style={{ marginBottom: 0 }}><strong>{rupeesInWords(v.total)}</strong></p>
        <p className="tiny faint">Paid online through Razorpay. This is a computer-generated invoice and needs no signature.</p>
      </div>
    </div>
  );
}
