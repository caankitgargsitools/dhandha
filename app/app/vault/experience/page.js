import { getContext, inr } from "@/lib/session";
import FormState from "../../FormState";
import DeleteButton from "../../DeleteButton";
import { addExperience } from "../../actions";

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
          <table>
            <thead><tr><th>Client</th><th>Work</th><th>Value</th><th>Period</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>{i.client}</td>
                  <td>{i.work_name}{i.category && <div className="muted small">{i.category}</div>}</td>
                  <td>{i.value_inr ? `₹${inr(i.value_inr)}` : "—"}</td>
                  <td className="small">{i.start_date ? new Date(i.start_date).toLocaleDateString("en-IN") : "?"} – {i.end_date ? new Date(i.end_date).toLocaleDateString("en-IN") : "…"}</td>
                  <td><span className={`chip ${i.status === "completed" ? "ok" : "info"}`}>{i.status}</span></td>
                  <td>{isAdmin && <DeleteButton table="experience_items" id={i.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
