import Link from "next/link";
import { getAdminContext } from "@/lib/admin";
import { CATEGORIES, STAFF_STATUS, PRIORITY, ago } from "@/lib/tickets";

const TABS = [["active", "Needs attention"], ["waiting_on_customer", "Waiting on customer"], ["resolved", "Resolved"], ["all", "All"]];
const RANK = { urgent: 0, high: 1, normal: 2, low: 3 };

export default async function AdminTickets({ searchParams }) {
  const params = await searchParams;
  const tab = TABS.some(([k]) => k === params?.tab) ? params.tab : "active";
  const { supabase } = await getAdminContext();
  const { data: all } = await supabase.from("tickets").select("*, tenants(name)").order("last_reply_at", { ascending: false });
  const list = (all || []).filter((t) => tab === "active" ? ["open", "in_progress"].includes(t.status) : tab === "all" ? true : tab === "resolved" ? ["resolved", "closed"].includes(t.status) : t.status === tab)
    .sort((a, b) => (tab === "active" ? RANK[a.priority] - RANK[b.priority] : 0));
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Ticket queue</h1><p>Urgent and high-priority tickets first. Replying sets the ticket to In progress unless you choose another status.</p></div></div>
      <div className="row">{TABS.map(([k, l]) => <Link key={k} href={`/admin/tickets?tab=${k}`} className={`btn sm ${tab === k ? "" : "ghost"}`}>{l} <span className="faint">({(all || []).filter((t) => k === "active" ? ["open", "in_progress"].includes(t.status) : k === "all" ? true : k === "resolved" ? ["resolved", "closed"].includes(t.status) : t.status === k).length})</span></Link>)}</div>
      <div className="panel flush table-wrap">
        <table>
          <thead><tr><th>Ticket</th><th>Customer</th><th>About</th><th>Priority</th><th>Status</th><th>Last reply</th></tr></thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.id}>
                <td><Link href={`/admin/tickets/${t.id}`}><strong>{t.subject}</strong></Link><div className="tiny faint">#{t.number}</div></td>
                <td className="small">{t.tenants?.name}</td>
                <td className="small">{CATEGORIES[t.category]}</td>
                <td><span className={`chip ${PRIORITY[t.priority][0]}`}>{PRIORITY[t.priority][1]}</span></td>
                <td><span className={`chip ${STAFF_STATUS[t.status][0]}`}>{STAFF_STATUS[t.status][1]}</span></td>
                <td className="small faint">{ago(t.last_reply_at)}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={6} className="muted">Nothing here.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
