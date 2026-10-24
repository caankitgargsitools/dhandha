import { getContext } from "@/lib/session";
import FormState from "../../FormState";
import { saveType } from "../actions";

function TypeFields({ t = {} }) {
  return (
    <div className="form-grid">
      {t.id && <input type="hidden" name="id" value={t.id} />}
      <div><label>Name</label><input name="name" defaultValue={t.name || ""} placeholder="Online demo / Office visit" required /></div>
      <div><label>How</label><select name="mode" defaultValue={t.mode || "online"}><option value="online">Online call</option><option value="field">Field visit</option></select></div>
      <div><label>Meeting length (minutes)</label><input name="duration_min" type="number" min={5} max={480} defaultValue={t.duration_min || 30} /></div>
      <div><label>Break after it (minutes)</label><input name="buffer_min" type="number" min={0} max={120} defaultValue={t.buffer_min ?? 10} /></div>
      {t.id && <div><label>Status</label><select name="active" defaultValue={t.active ? "on" : "off"}><option value="on">In use</option><option value="off">Not in use</option></select></div>}
    </div>
  );
}

// What can be booked, how long it takes and the break after it (5–10 minutes keeps a packed day humane).
export default async function MeetingTypes() {
  const { supabase, company, role } = await getContext();
  const { data: types } = await supabase.from("meeting_types").select("*").eq("company_id", company.id).order("active", { ascending: false }).order("name");
  const can = ["admin", "manager"].includes(role);
  return (
    <>
      <div className="page-head"><div><h1>Meeting types</h1><p>Each type sets how long a meeting takes and the break after it. Days are filled meeting → break → meeting.</p></div></div>
      {can && <div className="panel stack-sm"><h3>Add a meeting type</h3><FormState action={saveType} submit="Add"><TypeFields /></FormState></div>}
      <div className="panel flush table-wrap">
        <table>
          <thead><tr><th>Name</th><th>How</th><th>Length</th><th>Break</th><th>Status</th></tr></thead>
          <tbody>
            {!types?.length && <tr><td colSpan={5} className="muted small">No meeting types yet — add “Online demo” (30 + 10 min) and “Office visit” (45 + 10 min) to start.</td></tr>}
            {(types || []).map((t) => (
              <tr key={t.id}>
                <td>{can ? <details><summary style={{ cursor: "pointer" }}><strong>{t.name}</strong></summary><div style={{ marginTop: 10 }}><FormState action={saveType} submit="Save"><TypeFields t={t} /></FormState></div></details> : <strong>{t.name}</strong>}</td>
                <td>{t.mode === "field" ? "Field visit" : "Online"}</td><td>{t.duration_min} min</td><td>{t.buffer_min} min</td>
                <td><span className={`chip ${t.active ? "ok" : "mute"}`}>{t.active ? "In use" : "Off"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
