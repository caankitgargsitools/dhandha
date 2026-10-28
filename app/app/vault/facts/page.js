import { getContext } from "@/lib/session";
import FormState from "../../FormState";
import EditableRow from "../../EditableRow";
import { saveFact, updateFact } from "../../actions";

const SUGGESTED = [
  ["fin.turnover", "Turnover", "INR", "FY 2024-25"],
  ["fin.net_worth", "Net worth", "INR", "FY 2024-25"],
  ["fin.profit_after_tax", "Profit after tax", "INR", "FY 2024-25"],
  ["people.count.total", "Total employees", "persons", ""],
  ["people.count.engineers", "Engineers / professionals", "persons", ""],
  ["exp.count.similar_works_5y", "Similar works completed in last 5 years", "works", ""],
  ["assets.machines", "Plant and machinery owned", "list", ""],
];

export default async function Facts() {
  const { supabase, company, isAdmin, role } = await getContext();
  const { data: facts } = await supabase.from("company_facts").select("*").eq("company_id", company.id).order("key").order("period");
  return (
    <div className="stack">
      <div>
        <h1>Facts</h1>
        <p className="muted" style={{ margin: 0 }}>
          Every answer you give Dhandha is saved here and reused, so no form asks you twice. You can edit any of them.
        </p>
      </div>
      {role !== "viewer" && (
        <div className="panel">
          <h3>Add or update a fact</h3>
          <FormState action={saveFact} submit="Save fact">
            <div className="form-grid">
              <div>
                <label htmlFor="key">Fact</label>
                <input id="key" name="key" list="fact-keys" required placeholder="fin.turnover" />
                <datalist id="fact-keys">
                  {SUGGESTED.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </datalist>
              </div>
              <div><label htmlFor="period">Period (if any)</label><input id="period" name="period" placeholder="FY 2024-25" /></div>
              <div><label htmlFor="value">Value</label><input id="value" name="value" required /></div>
              <div><label htmlFor="unit">Unit</label><input id="unit" name="unit" placeholder="INR, persons…" /></div>
              <div><label htmlFor="valid_until">Re-check after</label><input id="valid_until" name="valid_until" type="date" /></div>
            </div>
          </FormState>
          <p className="muted small" style={{ marginBottom: 0 }}>Same fact and period again = update. Common facts: {SUGGESTED.map((s) => s[1]).join(", ")}.</p>
        </div>
      )}
      <div className="panel">
        {!facts?.length ? (
          <p className="muted small">No facts saved yet. Turnover and net worth for the last 3 years are the most asked.</p>
        ) : (
          <div className="table-wrap"><table>
            <thead><tr><th>Fact</th><th>Period</th><th>Value</th><th>Source</th><th>Updated</th><th></th></tr></thead>
            <tbody>
              {facts.map((f) => (
                <EditableRow key={f.id} id={f.id} action={updateFact} colSpan={6} canEdit={role !== "viewer"} canDelete={isAdmin} deleteTable="company_facts" form={
                  <div className="form-grid">
                    <div><label htmlFor={`key-${f.id}`}>Fact</label><input id={`key-${f.id}`} name="key" list="fact-keys" required defaultValue={f.key} /></div>
                    <div><label htmlFor={`period-${f.id}`}>Period (if any)</label><input id={`period-${f.id}`} name="period" defaultValue={f.period || ""} /></div>
                    <div><label htmlFor={`value-${f.id}`}>Value</label><input id={`value-${f.id}`} name="value" required defaultValue={f.value ?? ""} /></div>
                    <div><label htmlFor={`unit-${f.id}`}>Unit</label><input id={`unit-${f.id}`} name="unit" defaultValue={f.unit || ""} /></div>
                    <div><label htmlFor={`valid_until-${f.id}`}>Re-check after</label><input id={`valid_until-${f.id}`} name="valid_until" type="date" defaultValue={f.valid_until ? String(f.valid_until).slice(0, 10) : ""} /></div>
                  </div>
                }>
                  <td>{/^(presence|gst|cert|reg|age|cond)\./.test(f.key) && f.unit ? <>{f.unit}<div className="tiny faint"><code>{f.key}</code></div></> : <code>{f.key}</code>}</td>
                  <td>{f.period || "—"}</td>
                  <td>{/^(presence|gst|cert|reg|age|cond)\./.test(f.key) ? <span className={`chip ${f.value === "yes" ? "ok" : f.value === "no" ? "bad" : "mute"}`}>{f.value === "yes" ? "Yes" : f.value === "no" ? "No" : f.value}</span> : f.unit === "INR" && !isNaN(Number(f.value)) ? `₹${Number(f.value).toLocaleString("en-IN")}` : `${f.value}${f.unit && f.unit !== "INR" ? " " + f.unit : ""}`}</td>
                  <td className="small">{f.source}</td>
                  <td className="small muted">{new Date(f.updated_at).toLocaleDateString("en-IN")}</td>
                </EditableRow>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
