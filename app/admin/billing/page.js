import { getAdminContext } from "@/lib/admin";
import { fmtDate, inr } from "@/lib/session";
import FormState from "@/app/app/FormState";
import Icon from "@/components/Icon";
import { razorpayReady } from "@/lib/razorpay";
import { saveBilling } from "../actions";

const STATES = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"];

export default async function AdminBilling() {
  const { supabase } = await getAdminContext();
  const [{ data: s }, { data: hook }, { data: orders }, { data: events }, { data: tenants }] = await Promise.all([
    supabase.from("billing_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.rpc("billing_webhook_ready"),
    supabase.from("billing_orders").select("*").neq("status", "draft").order("created_at", { ascending: false }).limit(30),
    supabase.from("billing_events").select("id, event, result, razorpay_order_id, razorpay_payment_id, received_at").order("received_at", { ascending: false }).limit(20),
    supabase.from("tenants").select("id, name"),
  ]);
  const tname = (id) => (tenants || []).find((t) => t.id === id)?.name || id.slice(0, 8);
  const paid = (orders || []).filter((o) => o.status === "paid");
  const checks = [
    [razorpayReady(), "Razorpay keys in Vercel", "Vercel → dhandha → Settings → Environment Variables: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (from Razorpay → Account & Settings → API keys). Redeploy after adding."],
    [!!hook, "Webhook secret in Supabase Vault", "Razorpay → Webhooks → Add: URL https://<your domain>/api/razorpay/webhook, events payment.captured, order.paid, payment.failed, and a secret you choose. Put the same secret in Supabase → Project Settings → Vault as a secret named razorpay_webhook_secret."],
    [!!(s?.seller_gstin && s?.seller_state), "Seller GSTIN and state", "Fill in the form below. Checkout stays off until these are set."],
  ];
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Billing</h1><p>Razorpay payments, GST invoices and plan pricing. Credits are added only when Razorpay&apos;s signed webhook confirms a payment.</p></div></div>
      <div className="grid-3">
        <div className="panel ledger"><div className="kpi-label">Collected (last 30 shown)</div><div className="kpi">₹{inr(paid.reduce((t, o) => t + Number(o.total_inr), 0))}</div><div className="faint small">{paid.length} payments</div></div>
        <div className="panel" style={{ gridColumn: "span 2" }}>
          <h3>Switch-on checklist</h3>
          <ul className="reasons">{checks.map(([ok, label, help]) => (
            <li key={label}><Icon name={ok ? "check" : "alert"} size={14} style={{ color: ok ? "var(--ok)" : "var(--blood)" }} /><span><strong>{label}</strong>{!ok && <div className="tiny faint">{help}</div>}</span></li>
          ))}</ul>
        </div>
      </div>

      <div className="panel">
        <h3>Seller details on invoices</h3>
        <FormState action={saveBilling}>
          <div className="form-grid">
            <div><label htmlFor="seller_name">Legal name</label><input id="seller_name" name="seller_name" defaultValue={s?.seller_name || ""} /></div>
            <div><label htmlFor="seller_gstin">GSTIN</label><input id="seller_gstin" name="seller_gstin" defaultValue={s?.seller_gstin || ""} maxLength={15} /></div>
            <div><label htmlFor="seller_state">State (decides CGST+SGST or IGST)</label>
              <select id="seller_state" name="seller_state" defaultValue={s?.seller_state || ""}><option value="">—</option>{STATES.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label htmlFor="sac_code">SAC code</label><input id="sac_code" name="sac_code" defaultValue={s?.sac_code || ""} /></div>
            <div><label htmlFor="invoice_prefix">Invoice prefix</label><input id="invoice_prefix" name="invoice_prefix" defaultValue={s?.invoice_prefix || "DH"} maxLength={10} /></div>
          </div>
          <div><label htmlFor="seller_address">Address</label><textarea id="seller_address" name="seller_address" rows={2} defaultValue={s?.seller_address || ""} /></div>
          <div className="form-grid">
            <div><label htmlFor="suite_fee_inr">Full suite fee ₹ / 30 days</label><input id="suite_fee_inr" name="suite_fee_inr" inputMode="decimal" defaultValue={s?.suite_fee_inr ?? 2499} /></div>
            <div><label htmlFor="suite_credits">Full suite credits</label><input id="suite_credits" name="suite_credits" inputMode="decimal" defaultValue={s?.suite_credits ?? 1500} /></div>
            <div><label htmlFor="min_topup_inr">Smallest top-up ₹</label><input id="min_topup_inr" name="min_topup_inr" inputMode="decimal" defaultValue={s?.min_topup_inr ?? 200} /></div>
          </div>
          <p className="tiny faint" style={{ margin: 0 }}>Invoices already issued keep the details they were issued with. Numbers run per financial year: {s?.invoice_prefix || "DH"}/2026-27/0001.</p>
        </FormState>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="panel flush table-wrap">
          <table>
            <thead><tr><th>Workspace</th><th>What</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {!(orders || []).length && <tr><td colSpan={4} className="muted">No payments yet.</td></tr>}
              {(orders || []).map((o) => (
                <tr key={o.id}><td className="small">{tname(o.tenant_id)}<div className="tiny faint">{fmtDate(o.created_at)}</div></td>
                  <td className="small">{o.kind === "topup" ? `${inr(o.credits)} credits` : o.suite ? "Full suite" : o.modules.join(", ")}</td>
                  <td className="num small">₹{inr(o.total_inr)}</td><td><span className={`chip ${o.status === "paid" ? "ok" : o.status === "failed" ? "bad" : "warn"}`}>{o.status}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3>Webhook deliveries</h3>
          {!(events || []).length && <p className="small muted">None received yet.</p>}
          {(events || []).map((e) => (
            <div key={e.id} className="small" style={{ padding: "5px 0", borderTop: "1px solid var(--line-soft)" }}>
              <strong>{e.event}</strong> → <span className={e.result === "paid" ? "success" : /rejected/.test(e.result) ? "error" : ""}>{e.result}</span>
              <div className="tiny faint">{new Date(e.received_at).toLocaleString("en-IN")} · {e.razorpay_payment_id || e.razorpay_order_id}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
