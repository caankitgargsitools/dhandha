import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";

export default async function Audit() {
  const { supabase, tenant, isAdmin } = await getContext();
  if (!isAdmin) redirect("/app");
  const { data: rows } = await supabase.from("audit_log").select("*").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(200);
  return (
    <div className="stack">
      <div>
        <h1>Audit log</h1>
        <p className="muted" style={{ margin: 0 }}>Every change to the Vault, brand assets and signature use. Latest 200 shown.</p>
      </div>
      <div className="panel">
        <table>
          <thead><tr><th>When</th><th>Action</th><th>What</th><th>Detail</th></tr></thead>
          <tbody>{(rows || []).map((r) => (
            <tr key={r.id}>
              <td className="small">{new Date(r.created_at).toLocaleString("en-IN")}</td>
              <td><span className="chip info">{r.action}</span></td>
              <td>{r.entity}</td>
              <td className="small muted">{Object.entries(r.detail || {}).map(([k, v]) => `${k}: ${v}`).join(", ")}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
