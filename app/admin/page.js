import Link from "next/link";
import { getAdminContext } from "@/lib/admin";
import { inr, daysLeft, fmtDate } from "@/lib/session";
import { DayBars, Donut } from "@/components/Charts";
import { STAFF_STATUS, PRIORITY, ago } from "@/lib/tickets";

export default async function AdminOverview() {
  const { supabase } = await getAdminContext();
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const [{ data: tenants }, { data: profiles }, { data: wallets }, { data: subs }, { data: ledger }, { data: tickets }] = await Promise.all([
    supabase.from("tenants").select("id, name, kind, created_at, trial_ends_at").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id"),
    supabase.from("wallets").select("balance"),
    supabase.from("subscriptions").select("tenant_id, status, module_code"),
    supabase.from("credit_ledger").select("delta, created_at").gte("created_at", since),
    supabase.from("tickets").select("id, number, subject, status, priority, last_reply_at, tenants(name)").order("last_reply_at", { ascending: false }),
  ]);
  const paying = new Set((subs || []).filter((s) => s.status === "active").map((s) => s.tenant_id));
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 864e5);
    const key = d.toISOString().slice(0, 10);
    return { label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), value: (tenants || []).filter((t) => t.created_at.slice(0, 10) === key).length };
  });
  const spent = (ledger || []).filter((l) => Number(l.delta) < 0).reduce((s, l) => s - Number(l.delta), 0);
  const tk = tickets || [];
  const statusParts = [["open", "var(--marigold)"], ["in_progress", "var(--sky)"], ["waiting_on_customer", "var(--blood)"], ["resolved", "var(--leaf)"], ["closed", "var(--ink-3)"]]
    .map(([s, color]) => ({ label: STAFF_STATUS[s][1], value: tk.filter((t) => t.status === s).length, color }));
  const queue = tk.filter((t) => ["open", "in_progress"].includes(t.status));

  return (
    <div className="stack">
      <div className="page-head"><div><h1>Overview</h1><p>How Dhandha is doing across all customers.</p></div></div>
      <div className="grid">
        <div className="panel ledger"><div className="kpi-label">Workspaces</div><div className="kpi">{tenants?.length || 0}</div><div className="faint small">{paying.size} paying · {(tenants?.length || 0) - paying.size} on trial</div></div>
        <div className="panel ledger"><div className="kpi-label">Users</div><div className="kpi">{profiles?.length || 0}</div><div className="faint small">across all workspaces</div></div>
        <div className="panel ledger"><div className="kpi-label">Credits in wallets</div><div className="kpi">{inr((wallets || []).reduce((s, w) => s + Number(w.balance), 0))}</div><div className="faint small">customer balances</div></div>
        <div className="panel ledger"><div className="kpi-label">Credits used, 30 days</div><div className="kpi">{inr(spent)}</div><div className="faint small">billable usage</div></div>
      </div>
      <div className="grid-2">
        <div className="panel">
          <div className="panel-head"><h3>New workspaces, last 30 days</h3><span className="faint small">{days.reduce((s, d) => s + d.value, 0)} sign-ups</span></div>
          <DayBars days={days} label="Sign-ups per day" />
        </div>
        <div className="panel">
          <div className="panel-head"><h3>Tickets</h3><Link href="/admin/tickets" className="small">Open queue</Link></div>
          <div className="row" style={{ flexWrap: "nowrap", gap: 18 }}>
            <Donut parts={statusParts} size={120} center={String(tk.length)} />
            <div className="small" style={{ display: "grid", gap: 6 }}>
              {statusParts.map((p) => <span key={p.label} className="row" style={{ gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: p.color }} />{p.label}<strong className="num">{p.value}</strong></span>)}
            </div>
          </div>
        </div>
      </div>
      <div className="grid-2">
        <div className="panel flush">
          <div className="panel-head" style={{ padding: "18px 22px 6px" }}><h3>Needs a reply</h3><span className="faint small">{queue.length}</span></div>
          {queue.slice(0, 6).map((t) => (
            <Link key={t.id} href={`/admin/tickets/${t.id}`} className="row" style={{ padding: "12px 22px", borderTop: "1px solid var(--line-soft)", color: "inherit", flexWrap: "nowrap" }}>
              <span className={`chip ${PRIORITY[t.priority][0]}`}>{PRIORITY[t.priority][1]}</span>
              <div style={{ flex: 1, minWidth: 0 }}><strong>{t.subject}</strong><div className="tiny faint">#{t.number} · {t.tenants?.name} · {ago(t.last_reply_at)}</div></div>
            </Link>
          ))}
          {!queue.length && <p className="muted small" style={{ padding: "0 22px 18px" }}>All caught up.</p>}
        </div>
        <div className="panel flush">
          <div className="panel-head" style={{ padding: "18px 22px 6px" }}><h3>Newest workspaces</h3><Link href="/admin/tenants" className="small">All</Link></div>
          {(tenants || []).slice(0, 6).map((t) => {
            const left = daysLeft(t.trial_ends_at);
            return (
              <Link key={t.id} href={`/admin/tenants/${t.id}`} className="row between" style={{ padding: "12px 22px", borderTop: "1px solid var(--line-soft)", color: "inherit", flexWrap: "nowrap" }}>
                <div style={{ minWidth: 0 }}><strong>{t.name}</strong><div className="tiny faint">{t.kind === "firm" ? "Firm" : "Business"} · joined {fmtDate(t.created_at)}</div></div>
                {paying.has(t.id) ? <span className="chip ok">Paying</span> : left >= 0 ? <span className="chip warn">Trial · {left} d</span> : <span className="chip bad">Trial ended</span>}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
