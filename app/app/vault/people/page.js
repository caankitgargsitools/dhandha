import { getContext } from "@/lib/session";
import FormState from "../../FormState";
import EditableRow from "../../EditableRow";
import { addPerson, updatePerson } from "../../actions";

// Partner / Proprietor / Director in the designation makes the person a "Partner N" in tender formats (lib/masters.js partnerList).
const ROLES = ["Partner", "Managing Partner", "Proprietor", "Director", "Managing Director"];
const isPartner = (p) => /partner|proprietor|director/i.test(p.designation || "");

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
            <datalist id="designations">{ROLES.map((r) => <option key={r} value={r} />)}</datalist>
            <div className="form-grid">
              <div><label htmlFor="name">Name</label><input id="name" name="name" required /></div>
              <div><label htmlFor="designation">Designation</label><input id="designation" name="designation" list="designations" placeholder="Partner, Proprietor, Director, Manager…" /></div>
              <div><label htmlFor="qualification">Qualification</label><input id="qualification" name="qualification" placeholder="CA, B.Tech Civil, CISA…" /></div>
              <div><label htmlFor="years_experience">Years of experience</label><input id="years_experience" name="years_experience" inputMode="decimal" /></div>
              <div><label htmlFor="membership_no">Membership no. (ICAI etc.)</label><input id="membership_no" name="membership_no" /></div>
              <div><label htmlFor="pan">PAN</label><input id="pan" name="pan" placeholder="ABCDE1234F" style={{ textTransform: "uppercase" }} /></div>
            </div>
            <p className="muted small" style={{ margin: 0 }}>A designation with Partner, Proprietor or Director makes the person a partner in tender formats.</p>
          </FormState>
        </div>
      )}
      <div className="panel table-wrap">
        {!people?.length ? <p className="muted small">No people added yet.</p> : (
          <table>
            <thead><tr><th>Name</th><th>Designation</th><th>Qualification</th><th>Experience</th><th>Membership no.</th><th>PAN</th><th></th></tr></thead>
            <tbody>
              {people.map((p) => (
                <EditableRow key={p.id} id={p.id} action={updatePerson} colSpan={7} canEdit={role !== "viewer"} canDelete={isAdmin} deleteTable="people" form={
                  <div className="form-grid">
                    <div><label htmlFor={`name-${p.id}`}>Name</label><input id={`name-${p.id}`} name="name" required defaultValue={p.name || ""} /></div>
                    <div><label htmlFor={`designation-${p.id}`}>Designation</label><input id={`designation-${p.id}`} name="designation" list="designations" placeholder="Partner, Proprietor, Director, Manager…" defaultValue={p.designation || ""} /></div>
                    <div><label htmlFor={`qualification-${p.id}`}>Qualification</label><input id={`qualification-${p.id}`} name="qualification" defaultValue={p.qualification || ""} /></div>
                    <div><label htmlFor={`years_experience-${p.id}`}>Years of experience</label><input id={`years_experience-${p.id}`} name="years_experience" inputMode="decimal" defaultValue={p.years_experience ?? ""} /></div>
                    <div><label htmlFor={`membership_no-${p.id}`}>Membership no. (ICAI etc.)</label><input id={`membership_no-${p.id}`} name="membership_no" defaultValue={p.membership_no || ""} /></div>
                    <div><label htmlFor={`pan-${p.id}`}>PAN</label><input id={`pan-${p.id}`} name="pan" style={{ textTransform: "uppercase" }} defaultValue={p.pan || ""} /></div>
                  </div>
                }>
                  <td>{p.name}</td><td>{p.designation || "—"}{isPartner(p) && <> <span className="chip info">partner</span></>}</td><td>{p.qualification || "—"}</td>
                  <td>{p.years_experience != null ? `${p.years_experience} yrs` : "—"}</td><td>{p.membership_no || "—"}</td>
                  <td>{p.pan || "—"}</td>
                </EditableRow>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
