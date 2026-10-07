import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminContext } from "@/lib/admin";
import { inr, fmtDate, daysLeft } from "@/lib/session";
import { Sparkline } from "@/components/Charts";
import { STAFF_STATUS, ago } from "@/lib/tickets";
import FormState from "@/app/app/FormState";
import { adjustCredits } from "../../actions";
import MemberTable from "@/components/MemberTable";
import AddMemberForm from "@/components/AddMemberForm";

export default async function AdminTenant({ params }) {
  const { id } = await params;
  const { supabase } = await getAdminContext();
  const { data: t } = await supabase.from("tenants").select("*").eq("id", id).maybeSingle();
  if (!t) notFound();
  const [{ data: wallet }, { data: ledger }, { data: companies }, { data: members }, { data: tickets }, { data: subs }, { data: docs }] = await Promise.all([
    supabase.from("wallets").select("*").eq("tenant_id", id).maybeSingle(),
    supabase.from("credit_ledger").select("*").eq("tenant_id", id).order("created_at", { ascending: false }).limit(30),
    supabase.from("companies").select("id, legal_name, gstin, state, created_at").eq("tenant_id", id).order("created_at"),
    supabase.from("tenant_members").select("user_id, role, created_at, profiles(full_name, email, phone)").eq("tenant_id", id).order("created_at"),
    supabase.from("tickets").select("*").eq("tenant_id", id).order("last_reply_at", { ascending: false }),
    supabase.from("subscriptions").select("*").eq("tenant_id", id),
    supabase.from("documents").select("id").eq("tenant_id", id),
  ]);
  const { data: invites } = await supabase.from("invites").select("*").eq("tenant_id", id).is("accepted_at", null).is("revoked_at", null);
  const left = daysLeft(t.trial_ends_at);
  return (
    <div className="stack">
      <Link href="/admin/tenants" className="small">All workspaces</Link>
      <div className="page-head">
        <div><h1>{t.name}</h1><p>{t.kind === "firm" ? "CA / consultant firm" : "Business"} · joined {fmtDate(t.created_at)} · trial {left >= 0 ? `ends in ${left} days` : `ended ${fmtDate(t.trial_ends_at)}`}</p></div>
      </div>
      <div className="grid-3">
        <div className="panel ledger"><div className="kpi-label">Credit balance</div><div className="kpi">{inr(wallet?.balance)}</div>
          <Sparkline points={[...(ledger || [])].reverse().map((l) => Number(l.balance_after))} height={36} label="Balance history" /></div>
        <div className="panel ledger"><div className="kpi-label">Companies · documents</div><div className="kpi">{companies?.length || 0} · {docs?.length || 0}</div><div className="faint small">in their Vault</div></div>
        <div className="panel ledger"><div className="kpi-label">Tickets</div><div className="kpi">{tickets?.length || 0}</div><div className="faint small">{(tickets || []).filter((k) => !["resolved", "closed"].includes(k.status)).length} open</div></div>
      </div>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="stack">
          <div className="panel flush">
            <div className="panel-head" style={{ padding: "18px 22px 6px" }}><h3>People</h3><span className="faint small">{(members || []).filter((m) => m.role !== "disabled").length} active</span></div>
            <MemberTable members={members || []} invites={invites || []} canManage tenantId={t.id} selfId={null} />
            <div style={{ padding: "16px 22px", borderTop: "1px solid var(--line-soft)" }}><h3>Add a person to this workspace</h3><AddMemberForm tenantId={t.id} /></div>
          </div>
          <div className="panel flush table-wrap">
            <div className="panel-head" style={{ padding: "18px 22px 6px" }}><h3>Companies</h3></div>
            <table><tbody>{(companies || []).map((c) => (
              <tr key={c.id}><td><strong>{c.legal_name}</strong><div className="tiny faint">{c.gstin || "GSTIN not added"}</div></td><td className="small">{c.state || "—"}</td><td className="small faint">{fmtDate(c.created_at)}</td></tr>
            ))}</tbody></table>
          </div>
          <div className="panel flush">
            <div className="panel-head" style={{ padding: "18px 22px 6px" }}><h3>Tickets</h3></div>
            {(tickets || []).map((k) => (
              <Link key={k.id} href={`/admin/tickets/${k.id}`} className="row between" style={{ padding: "12px 22px", borderTop: "1px solid var(--line-soft)", color: "inherit", flexWrap: "nowrap" }}>
                <span><strong>{k.subject}</strong><div className="tiny faint">#{k.number} · {ago(k.last_reply_at)}</div></span>
                <span className={`chip ${STAFF_STATUS[k.status][0]}`}>{STAFF_STATUS[k.status][1]}</span>
              </Link>
            ))}
            {!tickets?.length && <p className="muted small" style={{ padding: "0 22px 18px" }}>No tickets.</p>}
          </div>
        </div>
        <div className="stack">
          <div className="panel">
            <h3>Adjust credits</h3>
            <p className="small muted">Goodwill credit, refund or correction. Use a minus sign to deduct. The customer sees the reason.</p>
            <FormState action={adjustCredits} submit="Apply">
              <input type="hidden" name="tenant_id" value={t.id} />
              <div className="form-grid">
                <div><label htmlFor="delta">Credits</label><input id="delta" name="delta" inputMode="decimal" placeholder="e.g. 200 or -50" required /></div>
                <div><label htmlFor="reason">Reason</label><input id="reason" name="reason" placeholder="Goodwill: ticket #1003" required /></div>
              </div>
            </FormState>
          </div>
          <div className="panel">
            <h3>Modules</h3>
            <div className="row" style={{ gap: 8 }}>{(subs || []).map((s) => <span key={s.module_code} className={`chip ${s.status === "active" ? "ok" : "warn"}`}>{s.module_code} · {s.status}</span>)}</div>
          </div>
          <div className="panel flush table-wrap">
            <div className="panel-head" style={{ padding: "18px 22px 6px" }}><h3>Credit history</h3></div>
            <table>
              <tbody>{(ledger || []).map((l) => (
                <tr key={l.id}><td className="small">{l.reason}<div className="tiny faint">{fmtDate(l.created_at)}{l.ref ? ` · ${l.ref}` : ""}</div></td>
                  <td className="right num" style={{ color: Number(l.delta) < 0 ? "var(--blood)" : "var(--leaf)", fontWeight: 700 }}>{Number(l.delta) > 0 ? "+" : ""}{inr(l.delta)}</td>
                  <td className="right num faint">{inr(l.balance_after)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
