import { getContext, inr } from "@/lib/session";
import FormState from "../../FormState";
import EditableRow from "../../EditableRow";
import { addExperience, updateExperience } from "../../actions";

const day = (d) => (d ? String(d).slice(0, 10) : "");

export default async function Experience() {
  const { supabase, company, isAdmin, role } = await getContext();
  const { data: items } = await supabase.from("experience_items").select("*").eq("company_id", company.id).order("end_date", { ascending: false, nullsFirst: true });
  const total = (items || []).reduce((s, i) => s + Number(i.value_inr || 0), 0);
  return (
    <div className="stack">
      <div>
        <h1>Experience</h1>
        <p className="muted" style={{ margin: 0 }}>Past and ongoing work orders. Tenders check these for “similar work” eligibility.</p>
      </div>
      {role !== "viewer" && (
        <div className="panel">
          <h3>Add a work</h3>
          <FormState action={addExperience} submit="Add work">
            <div className="form-grid">
              <div><label htmlFor="client">Client</label><input id="client" name="client" required /></div>
              <div><label htmlFor="work_name">Name of work</label><input id="work_name" name="work_name" required /></div>
              <div><label htmlFor="category">Category</label><input id="category" name="category" placeholder="Statutory audit, road work, AMC…" /></div>
              <div><label htmlFor="value_inr">Value (₹)</label><input id="value_inr" name="value_inr" inputMode="decimal" /></div>
              <div><label htmlFor="start_date">Start</label><input id="start_date" name="start_date" type="date" /></div>
              <div><label htmlFor="end_date">Completion</label><input id="end_date" name="end_date" type="date" /></div>
              <div>
                <label htmlFor="status">Status</label>
                <select id="status" name="status" defaultValue="completed"><option value="completed">Completed</option><option value="ongoing">Ongoing</option></select>
              </div>
            </div>
          </FormState>
        </div>
      )}
      <div className="panel">
        <h3>{items?.length || 0} works · ₹{inr(total)} in total</h3>
        {!!items?.length && (
          <div className="table-wrap"><table>
            <thead><tr><th>Client</th><th>Work</th><th>Value</th><th>Period</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {items.map((i) => (
                <EditableRow key={i.id} id={i.id} action={updateExperience} colSpan={6} canEdit={role !== "viewer"} canDelete={isAdmin} deleteTable="experience_items" form={
                  <div className="form-grid">
                    <div><label htmlFor={`client-${i.id}`}>Client</label><input id={`client-${i.id}`} name="client" required defaultValue={i.client || ""} /></div>
                    <div><label htmlFor={`work_name-${i.id}`}>Name of work</label><input id={`work_name-${i.id}`} name="work_name" required defaultValue={i.work_name || ""} /></div>
                    <div><label htmlFor={`category-${i.id}`}>Category</label><input id={`category-${i.id}`} name="category" defaultValue={i.category || ""} /></div>
                    <div><label htmlFor={`value_inr-${i.id}`}>Value (₹)</label><input id={`value_inr-${i.id}`} name="value_inr" inputMode="decimal" defaultValue={i.value_inr ?? ""} /></div>
                    <div><label htmlFor={`start_date-${i.id}`}>Start</label><input id={`start_date-${i.id}`} name="start_date" type="date" defaultValue={day(i.start_date)} /></div>
                    <div><label htmlFor={`end_date-${i.id}`}>Completion</label><input id={`end_date-${i.id}`} name="end_date" type="date" defaultValue={day(i.end_date)} /></div>
                    <div>
                      <label htmlFor={`status-${i.id}`}>Status</label>
                      <select id={`status-${i.id}`} name="status" defaultValue={i.status === "ongoing" ? "ongoing" : "completed"}><option value="completed">Completed</option><option value="ongoing">Ongoing</option></select>
                    </div>
                  </div>
                }>
                  <td>{i.client}</td>
                  <td>{i.work_name}{i.category && <div className="muted small">{i.category}</div>}</td>
                  <td>{i.value_inr ? `₹${inr(i.value_inr)}` : "—"}</td>
                  <td className="small">{i.start_date ? new Date(i.start_date).toLocaleDateString("en-IN") : "?"} – {i.end_date ? new Date(i.end_date).toLocaleDateString("en-IN") : "…"}</td>
                  <td><span className={`chip ${i.status === "completed" ? "ok" : "info"}`}>{i.status}</span></td>
                </EditableRow>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
