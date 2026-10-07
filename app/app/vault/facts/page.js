import { getContext } from "@/lib/session";
import FormState from "../../FormState";
import DeleteButton from "../../DeleteButton";
import { saveFact } from "../../actions";

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
          <table>
            <thead><tr><th>Fact</th><th>Period</th><th>Value</th><th>Source</th><th>Updated</th><th></th></tr></thead>
            <tbody>
              {facts.map((f) => (
                <tr key={f.id}>
                  <td><code>{f.key}</code></td>
                  <td>{f.period || "—"}</td>
                  <td>{f.unit === "INR" && !isNaN(Number(f.value)) ? `₹${Number(f.value).toLocaleString("en-IN")}` : `${f.value}${f.unit && f.unit !== "INR" ? " " + f.unit : ""}`}</td>
                  <td className="small">{f.source}</td>
                  <td className="small muted">{new Date(f.updated_at).toLocaleDateString("en-IN")}</td>
                  <td>{isAdmin && <DeleteButton table="company_facts" id={f.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
