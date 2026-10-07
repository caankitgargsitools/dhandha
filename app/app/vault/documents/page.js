import { getContext, daysLeft } from "@/lib/session";
import FormState from "../../FormState";
import DeleteButton from "../../DeleteButton";
import { addDocument } from "../../actions";

function expiryChip(d, tracks) {
  if (!d.valid_until) return tracks ? <span className="chip warn">Add expiry date</span> : <span className="muted small">—</span>;
  const left = daysLeft(d.valid_until);
  const when = new Date(d.valid_until).toLocaleDateString("en-IN");
  if (left < 0) return <span className="chip bad">Expired {when}</span>;
  if (left <= 15) return <span className="chip bad">{left} days left</span>;
  if (left <= 60) return <span className="chip warn">{left} days left</span>;
  return <span className="chip ok">Valid to {when}</span>;
}

export default async function Documents() {
  const { supabase, company, isAdmin, role } = await getContext();
  const [{ data: types }, { data: docs }] = await Promise.all([
    supabase.from("document_types").select("*").order("sort"),
    supabase.from("documents").select("*").eq("company_id", company.id).order("created_at", { ascending: false }),
  ]);
  const byType = Object.fromEntries((types || []).map((t) => [t.code, t]));
  const categories = [...new Set((types || []).map((t) => t.category))];
  const present = new Set((docs || []).map((d) => d.type_code));

  return (
    <div className="stack">
      <div>
        <h1>Documents</h1>
        <p className="muted" style={{ margin: 0 }}>
          Files stay in your Google Drive. Dhandha keeps the link, the key numbers and the expiry date, and alerts you
          60, 30, 15 and 7 days before anything lapses.
        </p>
      </div>
      <p className="notice small">
        Automatic Google Drive connection (pick files, read them with AI) switches on once the Google sign-in app is
        approved. Until then, paste each file's Drive link below.
      </p>

      {role !== "viewer" && (
        <div className="panel">
          <h3>Add a document</h3>
          <FormState action={addDocument} submit="Add document">
            <div className="form-grid">
              <div>
                <label htmlFor="type_code">Type</label>
                <select id="type_code" name="type_code" required defaultValue="">
                  <option value="" disabled>Select type</option>
                  {categories.map((cat) => (
                    <optgroup key={cat} label={cat}>
                      {types.filter((t) => t.category === cat).map((t) => (
                        <option key={t.code} value={t.code}>{t.name}{present.has(t.code) ? " ✓" : ""}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div><label htmlFor="title">Title (optional)</label><input id="title" name="title" placeholder="e.g. Audited accounts FY 2024-25" /></div>
              <div><label htmlFor="number">Certificate / reference no.</label><input id="number" name="number" /></div>
              <div><label htmlFor="period">Year / period</label><input id="period" name="period" placeholder="FY 2024-25" /></div>
              <div><label htmlFor="issued_on">Issued on</label><input id="issued_on" name="issued_on" type="date" /></div>
              <div><label htmlFor="valid_until">Valid until</label><input id="valid_until" name="valid_until" type="date" /></div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="drive_url">Google Drive link</label>
                <input id="drive_url" name="drive_url" type="url" placeholder="https://drive.google.com/file/d/…" />
              </div>
            </div>
          </FormState>
        </div>
      )}

      <div className="panel">
        <h3>In the Vault ({docs?.length || 0})</h3>
        {!docs?.length ? (
          <p className="muted small">No documents yet. Start with PAN, GST certificate, incorporation certificate and the last 3 years' audited accounts.</p>
        ) : (
          <table>
            <thead><tr><th>Document</th><th>No. / period</th><th>Expiry</th><th>File</th><th></th></tr></thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td><strong>{d.title || byType[d.type_code]?.name}</strong><div className="muted small">{d.type_code}</div></td>
                  <td>{d.number || "—"}{d.period ? <div className="muted small">{d.period}</div> : null}</td>
                  <td>{expiryChip(d, byType[d.type_code]?.tracks_expiry)}</td>
                  <td>{d.drive_url ? <a href={d.drive_url} target="_blank" rel="noreferrer">Open in Drive</a> : <span className="muted small">No link</span>}</td>
                  <td>{isAdmin && <DeleteButton table="documents" id={d.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
