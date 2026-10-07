import { getAdminContext } from "@/lib/admin";
import { fmtDate } from "@/lib/session";
import { ago } from "@/lib/tickets";
import KeyForm from "./KeyForm";
import { revokeKey } from "./actions";

export default async function Crawler() {
  const { supabase } = await getAdminContext();
  const [{ data: keys }, { data: runs }, { data: tenders }, { data: changes }] = await Promise.all([
    supabase.rpc("list_ingest_keys"),
    supabase.from("crawl_runs").select("*").order("started_at", { ascending: false }).limit(40),
    supabase.from("tenders").select("portal, status, due_at, last_seen_at"),
    supabase.from("tender_changes").select("id, field, seen_at").gte("seen_at", new Date(Date.now() - 7 * 864e5).toISOString()),
  ]);
  const live = (tenders || []).filter((t) => t.status === "live" && new Date(t.due_at) > new Date());
  const byPortal = Object.entries(live.reduce((m, t) => ((m[t.portal] = (m[t.portal] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Crawler</h1><p>Dhandha's own tender crawler runs on a server in India and posts here with an ingest key. Setup steps are in <code>crawler/README.md</code> in the repository.</p></div></div>
      <div className="grid-3">
        <div className="panel ledger"><div className="kpi-label">Live tenders</div><div className="kpi">{live.length}</div><div className="faint small">open for bidding</div></div>
        <div className="panel ledger"><div className="kpi-label">Changes, last 7 days</div><div className="kpi">{changes?.length || 0}</div><div className="faint small">corrigenda and date extensions</div></div>
        <div className="panel ledger"><div className="kpi-label">Last run</div><div className="kpi" style={{ fontSize: 22 }}>{runs?.[0] ? ago(runs[0].started_at) : "Never"}</div><div className="faint small">{runs?.[0]?.source || "no crawler connected yet"}</div></div>
      </div>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="panel flush table-wrap">
          <div className="panel-head" style={{ padding: "18px 22px 6px" }}><h3>Recent runs</h3></div>
          <table>
            <thead><tr><th>When</th><th>Source</th><th className="right">Received</th><th className="right">New</th><th className="right">Changed</th><th className="right">Matched</th></tr></thead>
            <tbody>
              {(runs || []).map((r) => (
                <tr key={r.id}><td className="small faint">{ago(r.started_at)}</td><td className="small">{r.source}</td><td className="right num">{r.received}</td><td className="right num">{r.inserted}</td><td className="right num">{r.changed}</td><td className="right num">{r.matched}</td></tr>
              ))}
              {!runs?.length && <tr><td colSpan={6} className="muted small">No runs yet. Start the crawler with an ingest key.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="stack">
          <div className="panel">
            <h3>Ingest keys</h3>
            <KeyForm />
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table><tbody>
                {(keys || []).map((k) => (
                  <tr key={k.id}><td><strong>{k.name}</strong><div className="tiny faint">created {fmtDate(k.created_at)}{k.last_used_at ? ` · used ${ago(k.last_used_at)}` : " · never used"}</div></td>
                    <td>{k.revoked_at ? <span className="chip mute">Revoked</span> : <form action={revokeKey}><input type="hidden" name="id" value={k.id} /><button className="danger">Revoke</button></form>}</td></tr>
                ))}
              </tbody></table>
            </div>
          </div>
          <div className="panel">
            <h3>Live tenders by portal</h3>
            {byPortal.map(([p, n]) => <div key={p} className="row between small" style={{ padding: "4px 0" }}><span>{p}</span><strong className="num">{n}</strong></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
