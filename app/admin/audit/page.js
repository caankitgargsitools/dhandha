import { getAdminContext } from "@/lib/admin";

export default async function AdminAudit() {
  const { supabase } = await getAdminContext();
  const { data: rows } = await supabase.from("audit_log").select("*, tenants(name)").order("created_at", { ascending: false }).limit(300);
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Audit log</h1><p>Latest 300 events across all workspaces.</p></div></div>
      <div className="panel flush table-wrap">
        <table>
          <thead><tr><th>When</th><th>Workspace</th><th>Action</th><th>What</th><th>Detail</th></tr></thead>
          <tbody>{(rows || []).map((r) => (
            <tr key={r.id}>
              <td className="small faint">{new Date(r.created_at).toLocaleString("en-IN")}</td>
              <td className="small">{r.tenants?.name || "—"}</td>
              <td><span className="chip info plain">{r.action}</span></td>
              <td className="small">{r.entity}</td>
              <td className="tiny faint">{Object.entries(r.detail || {}).map(([k, v]) => `${k}: ${v}`).join(", ")}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
