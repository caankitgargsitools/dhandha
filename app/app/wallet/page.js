import Link from "next/link";
import { getContext, inr, daysLeft, fmtDate } from "@/lib/session";
import { Sparkline } from "@/components/Charts";
import Icon from "@/components/Icon";
import { TopUp, PlanPicker } from "@/components/BillingForms";
import { razorpayReady } from "@/lib/razorpay";

const ORDER_CHIP = { draft: ["mute", "Not started"], created: ["warn", "Awaiting payment"], paid: ["ok", "Paid"], failed: ["bad", "Failed"] };

export default async function Wallet() {
  const { supabase, tenant, isAdmin } = await getContext();
  const [{ data: wallet }, { data: ledger }, { data: modules }, { data: prices }, { data: subs }, { data: settings }, { data: orders }, { data: invoices }] = await Promise.all([
    supabase.from("wallets").select("*").eq("tenant_id", tenant.id).maybeSingle(),
    supabase.from("credit_ledger").select("*").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("modules").select("*").order("sort"),
    supabase.from("price_book").select("*").order("module_code"),
    supabase.from("subscriptions").select("*").eq("tenant_id", tenant.id),
    supabase.from("billing_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("billing_orders").select("*").eq("tenant_id", tenant.id).neq("status", "draft").order("created_at", { ascending: false }).limit(20),
    supabase.from("invoices").select("id, invoice_no, total, issued_at, description").eq("tenant_id", tenant.id).order("issued_at", { ascending: false }).limit(50),
  ]);
  const subBy = Object.fromEntries((subs || []).map((s) => [s.module_code, s]));
  const live = (s) => s && ["active", "trial"].includes(s.status) && daysLeft(s.current_period_end) >= 0;
  const active = (subs || []).filter((s) => s.status === "active" && daysLeft(s.current_period_end) >= 0);
  const trialLeft = daysLeft(tenant.trial_ends_at);
  const paidTill = active.length ? active.reduce((m, s) => (new Date(s.current_period_end) > new Date(m) ? s.current_period_end : m), active[0].current_period_end) : null;
  const ready = razorpayReady() && settings?.seller_gstin && settings?.seller_state;
  const gstRate = Number(settings?.gst_rate ?? 18);

  return (
    <div className="stack">
      <div className="page-head"><div><h1>Credits & plan</h1><p>A small monthly fee per module, and credits for the work you run. Every payment gets a GST invoice.</p></div></div>
      <div className="grid">
        <div className="panel ledger"><div className="kpi-label">Balance (1 credit = ₹1)</div><div className="kpi">{inr(wallet?.balance)}</div>
          <Sparkline points={[...(ledger || [])].reverse().map((l) => Number(l.balance_after))} height={40} label="Balance over time" /></div>
        <div className="panel ledger"><div className="kpi-label">Plan</div>
          <div className="kpi" style={{ fontSize: 22 }}>{paidTill ? `Paid till ${fmtDate(paidTill)}` : trialLeft > 0 ? `Trial — ${trialLeft} days left` : "Trial ended"}</div>
          <div className="muted small">{active.length ? `${active.length} module${active.length > 1 ? "s" : ""} active` : "Choose modules below to continue after the trial."}</div></div>
      </div>

      {!ready && <div className="notice info small"><Icon name="wallet" /><span>Online payment is being switched on. Until then, ask support to add credits.</span></div>}
      {isAdmin ? (
        <div className="grid-2" style={{ alignItems: "start" }}>
          <div className="panel"><h3>Buy credits</h3><TopUp gstRate={gstRate} minTopup={Number(settings?.min_topup_inr ?? 200)} disabled={!ready} /></div>
          <div className="panel"><h3>Pay for your plan</h3>
            <PlanPicker modules={modules || []} active={active.map((s) => s.module_code)} gstRate={gstRate} suiteFee={Number(settings?.suite_fee_inr ?? 2499)} suiteCredits={Number(settings?.suite_credits ?? 1500)} disabled={!ready} /></div>
        </div>
      ) : <p className="small muted">Only the workspace admin can make payments.</p>}

      <div className="panel">
        <h3>Modules</h3>
        <div className="table-wrap"><table>
          <thead><tr><th>Module</th><th>Includes</th><th>Monthly fee</th><th>Credits included</th><th>Status</th></tr></thead>
          <tbody>
            {modules?.map((m) => {
              const s = subBy[m.code];
              return (
                <tr key={m.code}>
                  <td><strong>{m.name}</strong></td><td className="small">{m.description}</td>
                  <td>₹{inr(m.monthly_fee_inr)}</td><td>{inr(m.included_credits)}</td>
                  <td><span className={`chip ${live(s) ? (s.status === "active" ? "ok" : "info") : "mute"}`}>{live(s) ? `${s.status} till ${fmtDate(s.current_period_end).replace(/ \d{4}$/, "")}` : "off"}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
        <p className="muted small" style={{ marginBottom: 0 }}>Prices exclude {gstRate}% GST.</p>
      </div>

      {((invoices || []).length > 0 || (orders || []).length > 0) && (
        <div className="grid-2" style={{ alignItems: "start" }}>
          <div className="panel">
            <h3>GST invoices</h3>
            {!(invoices || []).length ? <p className="small muted">None yet.</p> : invoices.map((v) => (
              <Link key={v.id} href={`/app/wallet/invoices/${v.id}`} className="row between small" style={{ padding: "6px 0", borderTop: "1px solid var(--line-soft)" }}>
                <span><strong>{v.invoice_no}</strong><div className="tiny faint">{fmtDate(v.issued_at)} · {v.description}</div></span><span className="num">₹{inr(v.total)}</span>
              </Link>
            ))}
          </div>
          <div className="panel">
            <h3>Payments</h3>
            {(orders || []).map((o) => (
              <div key={o.id} className="row between small" style={{ padding: "6px 0", borderTop: "1px solid var(--line-soft)" }}>
                <span>{o.kind === "topup" ? `${inr(o.credits)} credits` : o.suite ? "Full suite" : `Plan: ${o.modules.join(", ")}`}<div className="tiny faint">{fmtDate(o.created_at)}</div></span>
                <span className="row" style={{ gap: 8 }}><span className="num">₹{inr(o.total_inr)}</span><span className={`chip ${ORDER_CHIP[o.status][0]}`}>{ORDER_CHIP[o.status][1]}</span></span>
              </div>
            ))}
            {!isAdmin && !(orders || []).length && <p className="small muted">Visible to the admin.</p>}
          </div>
        </div>
      )}

      <div className="panel">
        <h3>Pay-as-you-go rates</h3>
        <div className="table-wrap"><table>
          <thead><tr><th>Action</th><th>Credits</th><th>Per</th></tr></thead>
          <tbody>{prices?.map((p) => (
            <tr key={p.action_code}><td>{p.name}{p.note && <div className="muted small">{p.note}</div>}</td><td>{inr(p.credits)}</td><td className="small">{p.unit}</td></tr>
          ))}</tbody>
        </table></div>
      </div>

      <div className="panel">
        <h3>Usage history</h3>
        {!ledger?.length ? <p className="muted small">Nothing yet.</p> : (
          <div className="table-wrap"><table>
            <thead><tr><th>When</th><th>What</th><th>Credits</th><th>Balance</th></tr></thead>
            <tbody>{ledger.map((l) => (
              <tr key={l.id}>
                <td className="small">{new Date(l.created_at).toLocaleString("en-IN")}</td>
                <td>{l.reason}{l.ref && <div className="muted small">{l.ref}</div>}</td>
                <td style={{ color: Number(l.delta) < 0 ? "var(--bad)" : "var(--ok)" }}>{Number(l.delta) > 0 ? "+" : ""}{inr(l.delta)}</td>
                <td>{inr(l.balance_after)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
