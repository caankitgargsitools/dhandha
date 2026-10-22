import { getAdminContext } from "@/lib/admin";

export const maxDuration = 60;
import { fmtDate } from "@/lib/session";
import FormState from "@/app/app/FormState";
import Uploader from "./Uploader";
import { setDatasetStatus, suppress } from "./actions";

const BASIS = { public_business_info: "Public business info", consent: "Consent", own_customers: "Own customers" };

export default async function AdminData() {
  const { supabase } = await getAdminContext();
  const [{ data: sets }, { data: sold }, { count: optouts }] = await Promise.all([
    supabase.from("data_sets").select("*").order("created_at", { ascending: false }),
    supabase.from("data_purchases").select("set_id, credits"),
    supabase.from("data_suppression").select("id", { count: "exact", head: true }),
  ]);
  const by = (id) => (sold || []).filter((s) => s.set_id === id);
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Data marketplace</h1><p>Contact databases customers can search (contacts masked) and buy per record into their Leads. Only lawfully sourced data: every database carries its source and legal basis.</p></div></div>
      <div className="panel"><h3>Upload a database</h3><Uploader /></div>
      <div className="panel flush table-wrap">
        <div className="panel-head" style={{ padding: "18px 22px 6px" }}><h3>Databases</h3></div>
        <table>
          <thead><tr><th>Database</th><th>Source · basis</th><th className="right">Records</th><th className="right">Sold</th><th>Price / status</th></tr></thead>
          <tbody>
            {!sets?.length && <tr><td colSpan={5} className="muted small">None yet.</td></tr>}
            {(sets || []).map((s) => (
              <tr key={s.id}>
                <td><strong>{s.name}</strong><div className="tiny faint">{s.audience === "consumer" ? "Consumers" : "B2B"} · {fmtDate(s.created_at)} · filters: {(s.fields || []).filter((f) => f.facet).map((f) => f.label).join(", ") || "none"}</div></td>
                <td className="small">{s.source_label}<div className="tiny faint">{BASIS[s.lawful_basis]}</div></td>
                <td className="right num">{s.row_count.toLocaleString("en-IN")}</td>
                <td className="right num">{by(s.id).length.toLocaleString("en-IN")}<div className="tiny faint">{by(s.id).reduce((a, b) => a + Number(b.credits), 0).toLocaleString("en-IN")} cr</div></td>
                <td>
                  <form action={setDatasetStatus} className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                    <input type="hidden" name="id" value={s.id} />
                    <input name="price" type="number" step="0.1" min="0.1" defaultValue={s.price_credits} aria-label="Price per record" style={{ width: 70 }} />
                    <span className={`chip ${s.status === "live" ? "ok" : s.status === "draft" ? "warn" : "mute"}`}>{s.status}</span>
                    {s.status !== "live" ? <button name="status" value="live" className="sm">Go live</button> : <button name="status" value="withdrawn" className="sm ghost">Withdraw</button>}
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel" style={{ maxWidth: 640 }}>
        <h3>Remove a person (opt-out)</h3>
        <p className="small muted">Anyone who asks to be removed: add their email or mobile. They are hidden from every database and never sold again. {optouts || 0} on the list.</p>
        <FormState action={suppress} submit="Remove">
          <div className="form-grid">
            <div><label htmlFor="se">Email</label><input id="se" name="email" type="email" /></div>
            <div><label htmlFor="sp">Mobile</label><input id="sp" name="phone" inputMode="tel" /></div>
          </div>
          <div><label htmlFor="sr">Reason</label><input id="sr" name="reason" placeholder="e.g. requested by email on 22 Oct" /></div>
        </FormState>
      </div>
    </div>
  );
}
