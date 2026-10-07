import { getContext } from "@/lib/session";
import FormState from "../../FormState";
import { addCompany } from "../../actions";

export default async function Companies() {
  const { companies, isAdmin, company } = await getContext();
  return (
    <div className="stack">
      <div>
        <h1>Companies</h1>
        <p className="muted" style={{ margin: 0 }}>Each company has its own Vault, documents, letterhead and signature. Switch between them from the top bar.</p>
      </div>
      <div className="panel">
        <table>
          <thead><tr><th>Company</th><th></th></tr></thead>
          <tbody>{companies.map((c) => <tr key={c.id}><td>{c.legal_name}</td><td>{c.id === company.id && <span className="chip info">Selected</span>}</td></tr>)}</tbody>
        </table>
      </div>
      {isAdmin && (
        <div className="panel">
          <h3>Add a client company</h3>
          <FormState action={addCompany} submit="Add company">
            <div><label htmlFor="name">Legal name</label><input id="name" name="name" required /></div>
          </FormState>
          <p className="muted small" style={{ marginBottom: 0 }}>₹299 per extra company per month after the trial (draft price).</p>
        </div>
      )}
    </div>
  );
}
