import { getAdminContext } from "@/lib/admin";
import { fmtDate } from "@/lib/session";
import { ago } from "@/lib/tickets";
import KeyForm from "./KeyForm";
import LiveCrawler from "./LiveCrawler";
import { revokeKey } from "./actions";
import SubmitButton from "@/components/SubmitButton";

export default async function Crawler() {
  const { supabase } = await getAdminContext();
  const nowIso = new Date().toISOString();
  const liveCount = (portal) => {
    let q = supabase.from("tenders").select("id", { count: "exact", head: true }).eq("status", "live").gt("due_at", nowIso);
    if (portal) q = q.eq("portal", portal);
    return q.then((r) => r.count || 0);
  };
  const [{ data: keys }, { data: runs }, liveTotal, { count: changes }, { data: liveRunners }, { data: stepStats }] = await Promise.all([
    supabase.rpc("list_ingest_keys"),
    supabase.from("crawl_runs").select("*").order("started_at", { ascending: false }).limit(40),
    liveCount(),
    supabase.from("tender_changes").select("id", { count: "exact", head: true }).gte("seen_at", new Date(Date.now() - 7 * 864e5).toISOString()),
    supabase.from("crawler_live").select("*").order("updated_at", { ascending: false }),
    supabase.from("crawler_step_stats").select("step, avg_seconds"),
  ]);
  const stats = Object.fromEntries((stepStats || []).map((x) => [x.step, x]));
  // the crawler's steps are named "<portal> · tenders": that gives the portal list; each count is exact
  const portals = [...new Set((stepStats || []).map((x) => x.step).filter((st) => / · tenders$/.test(st)).map((st) => st.replace(/ · tenders$/, "")))];
  const counts = await Promise.all(portals.map(liveCount));
  const byPortal = portals.map((p, i) => [p, counts[i]]).filter(([, n]) => n).sort((a, b) => b[1] - a[1]);
  const other = liveTotal - counts.reduce((t, n) => t + n, 0);
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Crawler</h1><p>Dhandha&apos;s own tender crawler runs on the AWS Mumbai server (Docker; Watchtower pulls the newest image every hour) and posts here with an ingest key. The GitHub Actions workflow is only a manual fallback. Setup steps are in <code>crawler/README.md</code>.</p></div></div>
      <div className="grid-3">
        <div className="panel ledger"><div className="kpi-label">Live tenders</div><div className="kpi">{liveTotal}</div><div className="faint small">open for bidding</div></div>
        <div className="panel ledger"><div className="kpi-label">Changes, last 7 days</div><div className="kpi">{changes || 0}</div><div className="faint small">corrigenda and date extensions</div></div>
        <div className="panel ledger"><div className="kpi-label">Last run</div><div className="kpi" style={{ fontSize: 22 }}>{runs?.[0] ? ago(runs[0].started_at) : "Never"}</div><div className="faint small">{runs?.[0]?.source || "no crawler connected yet"}</div></div>
      </div>
      <LiveCrawler runners={liveRunners || []} stats={stats} />
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
                    <td>{k.revoked_at ? <span className="chip mute">Revoked</span> : <form action={revokeKey}><input type="hidden" name="id" value={k.id} /><SubmitButton className="danger" confirm="Revoke this key? The crawler using it stops posting.">Revoke</SubmitButton></form>}</td></tr>
                ))}
              </tbody></table>
            </div>
          </div>
          <div className="panel">
            <h3>Live tenders by portal</h3>
            {byPortal.map(([p, n]) => <div key={p} className="row between small" style={{ padding: "4px 0" }}><span>{p}</span><strong className="num">{n}</strong></div>)}
            {other > 0 && <div className="row between small" style={{ padding: "4px 0" }}><span className="muted">Other portals</span><strong className="num">{other}</strong></div>}
            {!liveTotal && <p className="small muted" style={{ margin: 0 }}>No live tenders yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
