import Link from "next/link";
import { getAdminContext } from "@/lib/admin";
import { inr, daysLeft, fmtDate, initials } from "@/lib/session";

export default async function AdminTenants() {
  const { supabase } = await getAdminContext();
  const [{ data: tenants }, { data: wallets }, { data: subs }, { data: companies }, { data: tickets }, { data: members }] = await Promise.all([
    supabase.from("tenants").select("*").order("created_at", { ascending: false }),
    supabase.from("wallets").select("*"),
    supabase.from("subscriptions").select("tenant_id, status"),
    supabase.from("companies").select("tenant_id"),
    supabase.from("tickets").select("tenant_id, status"),
    supabase.from("tenant_members").select("tenant_id, role, profiles(email, full_name)"),
  ]);
  const bal = Object.fromEntries((wallets || []).map((w) => [w.tenant_id, w.balance]));
  const count = (arr, id, f = () => true) => (arr || []).filter((x) => x.tenant_id === id && f(x)).length;
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Workspaces</h1><p>{tenants?.length || 0} customer workspaces. Open one to see its usage, tickets and to adjust credits.</p></div></div>
      <div className="panel flush table-wrap">
        <table>
          <thead><tr><th>Workspace</th><th>Owner</th><th>Plan</th><th className="right">Companies</th><th className="right">Credits</th><th className="right">Open tickets</th><th>Joined</th></tr></thead>
          <tbody>
            {(tenants || []).map((t) => {
              const owner = (members || []).find((m) => m.tenant_id === t.id && m.role === "admin")?.profiles;
              const paying = count(subs, t.id, (s) => s.status === "active") > 0;
              const left = daysLeft(t.trial_ends_at);
              const open = count(tickets, t.id, (k) => !["resolved", "closed"].includes(k.status));
              return (
                <tr key={t.id}>
                  <td>
                    <Link href={`/admin/tenants/${t.id}`} className="row" style={{ gap: 10, flexWrap: "nowrap", color: "inherit" }}>
                      <span className="co-avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{initials(t.name)}</span>
                      <span><strong>{t.name}</strong><div className="tiny faint">{t.kind === "firm" ? "CA / consultant firm" : "Business"}</div></span>
                    </Link>
                  </td>
                  <td className="small">{owner?.full_name}<div className="tiny faint">{owner?.email}</div></td>
                  <td>{paying ? <span className="chip ok">Paying</span> : left >= 0 ? <span className="chip warn">Trial · {left} d</span> : <span className="chip bad">Trial ended</span>}</td>
                  <td className="right num">{count(companies, t.id)}</td>
                  <td className="right num">{inr(bal[t.id])}</td>
                  <td className="right num">{open ? <span className="chip warn">{open}</span> : <span className="faint">0</span>}</td>
                  <td className="small faint">{fmtDate(t.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
