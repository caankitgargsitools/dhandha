import { getContext, inr, daysLeft } from "@/lib/session";

export default async function Wallet() {
  const { supabase, tenant } = await getContext();
  const [{ data: wallet }, { data: ledger }, { data: modules }, { data: prices }, { data: subs }] = await Promise.all([
    supabase.from("wallets").select("*").eq("tenant_id", tenant.id).maybeSingle(),
    supabase.from("credit_ledger").select("*").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("modules").select("*").order("sort"),
    supabase.from("price_book").select("*").order("module_code"),
    supabase.from("subscriptions").select("*").eq("tenant_id", tenant.id),
  ]);
  const subBy = Object.fromEntries((subs || []).map((s) => [s.module_code, s]));
  const trialLeft = daysLeft(tenant.trial_ends_at);
  const sum = (modules || []).reduce((s, m) => s + Number(m.monthly_fee_inr), 0);

  return (
    <div className="stack">
      <h1>Credits & plan</h1>
      <div className="grid">
        <div className="panel"><div className="muted small">Balance (1 credit = ₹1)</div><div className="stat">{inr(wallet?.balance)}</div></div>
        <div className="panel"><div className="muted small">Plan</div><div className="stat" style={{ fontSize: 20 }}>{trialLeft > 0 ? `Trial — ${trialLeft} days left` : "Trial ended"}</div>
          <div className="muted small">Choose modules before the trial ends. Online payment (Razorpay) is being switched on.</div></div>
      </div>

      <div className="panel">
        <h3>Modules</h3>
        <table>
          <thead><tr><th>Module</th><th>Includes</th><th>Monthly fee</th><th>Credits included</th><th>Status</th></tr></thead>
          <tbody>
            {modules?.map((m) => (
              <tr key={m.code}>
                <td><strong>{m.name}</strong></td><td className="small">{m.description}</td>
                <td>₹{inr(m.monthly_fee_inr)}</td><td>{inr(m.included_credits)}</td>
                <td><span className={`chip ${subBy[m.code]?.status === "active" ? "ok" : "info"}`}>{subBy[m.code]?.status || "off"}</span></td>
              </tr>
            ))}
            <tr><td><strong>Full suite</strong></td><td className="small">All modules, 5 users, 1,500 credits</td><td><strong>₹2,499</strong> <span className="muted small">(₹{inr(sum)} separately)</span></td><td>1,500</td><td></td></tr>
          </tbody>
        </table>
        <p className="muted small" style={{ marginBottom: 0 }}>Prices exclude 18% GST. A GST invoice is issued automatically for every payment.</p>
      </div>

      <div className="panel">
        <h3>Pay-as-you-go rates</h3>
        <table>
          <thead><tr><th>Action</th><th>Credits</th><th>Per</th></tr></thead>
          <tbody>{prices?.map((p) => (
            <tr key={p.action_code}><td>{p.name}{p.note && <div className="muted small">{p.note}</div>}</td><td>{inr(p.credits)}</td><td className="small">{p.unit}</td></tr>
          ))}</tbody>
        </table>
      </div>

      <div className="panel">
        <h3>Usage history</h3>
        {!ledger?.length ? <p className="muted small">Nothing yet.</p> : (
          <table>
            <thead><tr><th>When</th><th>What</th><th>Credits</th><th>Balance</th></tr></thead>
            <tbody>{ledger.map((l) => (
              <tr key={l.id}>
                <td className="small">{new Date(l.created_at).toLocaleString("en-IN")}</td>
                <td>{l.reason}{l.ref && <div className="muted small">{l.ref}</div>}</td>
                <td style={{ color: Number(l.delta) < 0 ? "var(--bad)" : "var(--ok)" }}>{Number(l.delta) > 0 ? "+" : ""}{inr(l.delta)}</td>
                <td>{inr(l.balance_after)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
