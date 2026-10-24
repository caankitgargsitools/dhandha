import { getAdminContext } from "@/lib/admin";
import { fmtDate } from "@/lib/session";
import FormState from "@/app/app/FormState";
import { uploadMca } from "../actions";

export default async function AdminMca() {
  const { supabase } = await getAdminContext();
  const [{ count }, { data: latest }, { data: runs }, { data: fetches }] = await Promise.all([
    supabase.from("mca_companies").select("cin", { count: "exact", head: true }),
    supabase.from("mca_companies").select("incorporated_on").order("incorporated_on", { ascending: false, nullsFirst: false }).limit(1),
    supabase.from("crawl_runs").select("*").like("source", "MCA:%").order("id", { ascending: false }).limit(12),
    supabase.from("mca_fetches").select("*").order("id", { ascending: false }).limit(6),
  ]);
  const LABEL = { loaded: ["ok", "Loaded"], blocked: ["bad", "MCA showed a bot check"], no_file: ["warn", "No file found on the page"], failed: ["bad", "Failed"] };
  return (
    <div className="stack">
      <div className="page-head"><div><h1>New companies (MCA)</h1><p>Newly registered companies and LLPs, shared by every customer&apos;s &quot;New companies&quot; lead page. Customers only ever see the ones matching their ideal client.</p></div></div>
      <div className="grid-3">
        <div className="panel ledger"><div className="kpi-label">Companies on file</div><div className="kpi">{(count || 0).toLocaleString("en-IN")}</div></div>
        <div className="panel ledger"><div className="kpi-label">Latest registration</div><div className="kpi" style={{ fontSize: 22 }}>{fmtDate(latest?.[0]?.incorporated_on)}</div></div>
      </div>
      <div className="panel stack-sm">
        <div className="panel-head" style={{ marginBottom: 0 }}><h3>Automatic monthly fetch</h3><span className="small faint">daily at 10:55 IST · GitHub Actions “mca monthly”</span></div>
        <p className="small muted" style={{ margin: 0 }}>Dhandha opens MCA&apos;s “incorporated during the month” page every day, loads the newest monthly file once, and sends you a phone alert. If MCA shows a bot check, nothing is attempted — you get an alert and upload the file below.</p>
        {!(fetches || []).length && <p className="small muted" style={{ margin: 0 }}>No automatic fetch yet.</p>}
        {(fetches || []).map((f) => (
          <div key={f.id} className="row between small" style={{ padding: "6px 0", borderTop: "1px solid var(--line-soft)", gap: 8 }}>
            <span><span className={`chip ${(LABEL[f.status] || LABEL.failed)[0]}`}>{(LABEL[f.status] || LABEL.failed)[1]}</span> {f.file_name || ""}{f.detail ? <span className="tiny faint"> · {f.detail}</span> : null}</span>
            <span className="faint">{f.status === "loaded" ? `${f.inserted} new · ${f.updated} updated · ` : ""}{fmtDate(f.created_at)}</span>
          </div>
        ))}
      </div>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="panel">
          <h3>Upload this month&apos;s file</h3>
          <p className="small muted">Download MCA&apos;s monthly list of companies and LLPs registered (mca.gov.in → Data &amp; Reports → Company statistics), or a company master data file from data.gov.in, and upload it here as .xlsx or .csv (up to 4 MB; split bigger files). Re-uploading is safe: companies are matched on CIN/LLPIN.</p>
          <FormState action={uploadMca} submit="Upload">
            <input type="file" name="file" accept=".xlsx,.csv,text/csv" required aria-label="MCA file" />
            <div><label htmlFor="label">Label</label><input id="label" name="label" placeholder="e.g. MCA Sep 2026" maxLength={60} /></div>
          </FormState>
        </div>
        <div className="panel">
          <h3>Uploads</h3>
          {!(runs || []).length && <p className="small muted">None yet.</p>}
          {(runs || []).map((r) => (
            <div key={r.id} className="row between small" style={{ padding: "6px 0", borderTop: "1px solid var(--line-soft)" }}>
              <span>{r.source.replace(/^MCA: /, "")}</span><span className="faint">{r.inserted} new · {r.changed} updated</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
