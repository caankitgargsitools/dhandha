import { getContext } from "@/lib/session";
import FormState from "../../FormState";
import { addCompany } from "../../actions";
import { setBillingCompany } from "../../wallet/actions";

export default async function Companies() {
  const { companies, isAdmin, company, tenant } = await getContext();
  const billing = companies.find((c) => c.id === tenant.billing_company_id) || companies[0];
  return (
    <div className="stack">
      <div>
        <h1>Companies</h1>
        <p className="muted" style={{ margin: 0 }}>Each company has its own Vault, documents, letterhead and signature. Switch between them from the top bar.</p>
      </div>
      <div className="panel">
        <div className="table-wrap"><table>
          <thead><tr><th>Company</th><th></th></tr></thead>
          <tbody>{companies.map((c) => <tr key={c.id}><td>{c.legal_name}</td><td className="row" style={{ gap: 6 }}>{c.id === company.id && <span className="chip info">Selected</span>}{c.id === billing?.id && <span className="chip mute">Billed by Dhandha</span>}</td></tr>)}</tbody>
        </table></div>
      </div>
      {isAdmin && companies.length > 1 && (
        <div className="panel">
          <h3>Dhandha's invoices go to</h3>
          <p className="muted small" style={{ marginTop: 0 }}>Credits and plans are invoiced to this company (its name, GSTIN and address), whichever company is selected in the top bar.</p>
          <FormState action={setBillingCompany} submit="Save">
            <div><label htmlFor="billing">Billing company</label>
              <select id="billing" name="company" defaultValue={billing?.id}>{companies.map((c) => <option key={c.id} value={c.id}>{c.legal_name}</option>)}</select></div>
          </FormState>
        </div>
      )}
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
