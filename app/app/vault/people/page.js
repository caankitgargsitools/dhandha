import { getContext } from "@/lib/session";
import FormState from "../../FormState";
import DeleteButton from "../../DeleteButton";
import { addPerson } from "../../actions";

export default async function People() {
  const { supabase, company, isAdmin, role } = await getContext();
  const { data: people } = await supabase.from("people").select("*").eq("company_id", company.id).order("name");
  return (
    <div className="stack">
      <div>
        <h1>Key people</h1>
        <p className="muted" style={{ margin: 0 }}>Staff whose qualifications and CVs are asked for in tenders and technical proposals.</p>
      </div>
      {role !== "viewer" && (
        <div className="panel">
          <h3>Add a person</h3>
          <FormState action={addPerson} submit="Add person">
            <div className="form-grid">
              <div><label htmlFor="name">Name</label><input id="name" name="name" required /></div>
              <div><label htmlFor="designation">Designation</label><input id="designation" name="designation" /></div>
              <div><label htmlFor="qualification">Qualification</label><input id="qualification" name="qualification" placeholder="CA, B.Tech Civil, CISA…" /></div>
              <div><label htmlFor="years_experience">Years of experience</label><input id="years_experience" name="years_experience" inputMode="decimal" /></div>
              <div><label htmlFor="membership_no">Membership no. (ICAI etc.)</label><input id="membership_no" name="membership_no" /></div>
              <div><label htmlFor="pan">PAN</label><input id="pan" name="pan" placeholder="ABCDE1234F" style={{ textTransform: "uppercase" }} /></div>
            </div>
          </FormState>
        </div>
      )}
      <div className="panel table-wrap">
        {!people?.length ? <p className="muted small">No people added yet.</p> : (
          <table>
            <thead><tr><th>Name</th><th>Designation</th><th>Qualification</th><th>Experience</th><th>Membership no.</th><th></th></tr></thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td><td>{p.designation || "—"}</td><td>{p.qualification || "—"}</td>
                  <td>{p.years_experience != null ? `${p.years_experience} yrs` : "—"}</td><td>{p.membership_no || "—"}</td>
                  <td>{isAdmin && <DeleteButton table="people" id={p.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
