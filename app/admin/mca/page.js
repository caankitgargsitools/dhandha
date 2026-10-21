import { getAdminContext } from "@/lib/admin";
import { fmtDate } from "@/lib/session";
import FormState from "@/app/app/FormState";
import { uploadMca } from "../actions";

export default async function AdminMca() {
  const { supabase } = await getAdminContext();
  const [{ count }, { data: latest }, { data: runs }] = await Promise.all([
    supabase.from("mca_companies").select("cin", { count: "exact", head: true }),
    supabase.from("mca_companies").select("incorporated_on").order("incorporated_on", { ascending: false, nullsFirst: false }).limit(1),
    supabase.from("crawl_runs").select("*").like("source", "MCA:%").order("id", { ascending: false }).limit(12),
  ]);
  return (
    <div className="stack">
      <div className="page-head"><div><h1>New companies (MCA)</h1><p>Newly registered companies and LLPs, shared by every customer&apos;s &quot;New companies&quot; lead page. Customers only ever see the ones matching their ideal client.</p></div></div>
      <div className="grid-3">
        <div className="panel ledger"><div className="kpi-label">Companies on file</div><div className="kpi">{(count || 0).toLocaleString("en-IN")}</div></div>
        <div className="panel ledger"><div className="kpi-label">Latest registration</div><div className="kpi" style={{ fontSize: 22 }}>{fmtDate(latest?.[0]?.incorporated_on)}</div></div>
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
