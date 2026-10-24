import { getContext } from "@/lib/session";
import FormState from "../../FormState";
import { saveRep } from "../actions";

const DAYS = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]];

function RepFields({ r = {}, members }) {
  const modes = r.modes || ["online", "field"], days = r.work_days || [1, 2, 3, 4, 5, 6];
  return (
    <>
      {r.id && <input type="hidden" name="id" value={r.id} />}
      <div className="form-grid">
        <div><label>Name</label><input name="name" defaultValue={r.name || ""} required /></div>
        <div><label>Their Dhandha login (for “My day” and alerts)</label>
          <select name="user_id" defaultValue={r.user_id || ""}><option value="">— none —</option>{members.map((m) => <option key={m.user_id} value={m.user_id}>{m.profiles?.full_name || m.profiles?.email} ({m.role})</option>)}</select></div>
        <div><label>Phone</label><input name="phone" defaultValue={r.phone || ""} inputMode="tel" /></div>
        <div><label>Day starts</label><input name="day_start" type="time" defaultValue={String(r.day_start || "09:30").slice(0, 5)} /></div>
        <div><label>Day ends</label><input name="day_end" type="time" defaultValue={String(r.day_end || "18:30").slice(0, 5)} /></div>
        <div><label>Start point (office or home — field visits start here)</label><input name="start_address" defaultValue={r.start_address || ""} placeholder="Full address" /></div>
      </div>
      <div className="row" style={{ gap: 14 }}>
        <span className="small" style={{ fontWeight: 600 }}>Takes:</span>
        {[["online", "Online calls"], ["field", "Field visits"]].map(([v, l]) => <label key={v} className="row small" style={{ gap: 6, margin: 0, fontWeight: 500 }}><input type="checkbox" name="modes" value={v} defaultChecked={modes.includes(v)} style={{ width: "auto" }} />{l}</label>)}
        <span className="small" style={{ fontWeight: 600, marginLeft: 8 }}>Works:</span>
        {DAYS.map(([v, l]) => <label key={v} className="row small" style={{ gap: 4, margin: 0, fontWeight: 500 }}><input type="checkbox" name="work_days" value={v} defaultChecked={days.includes(v)} style={{ width: "auto" }} />{l}</label>)}
        {r.id && <label className="row small" style={{ gap: 6, margin: 0, fontWeight: 500 }}><input type="checkbox" name="active" value="off" defaultChecked={false} style={{ width: "auto" }} />Remove from scheduling</label>}
      </div>
    </>
  );
}

// The sales team: who takes online calls and who visits, their hours, working days and start point.
export default async function SalesTeam() {
  const { supabase, tenant, company, role } = await getContext();
  const [{ data: reps }, { data: members }] = await Promise.all([
    supabase.from("sales_reps").select("*").eq("company_id", company.id).order("active", { ascending: false }).order("name"),
    supabase.from("tenant_members").select("user_id, role, profiles(full_name, email)").eq("tenant_id", tenant.id).neq("role", "disabled"),
  ]);
  const can = ["admin", "manager"].includes(role);
  return (
    <>
      <div className="page-head"><div><h1>Salespeople</h1><p>Online calls are packed back-to-back with the break you set per meeting type; field visits are planned as a route from each person's start point, with Google travel times.</p></div></div>
      {can && <div className="panel stack-sm"><h3>Add a salesperson</h3><FormState action={saveRep} submit="Add"><RepFields members={members || []} /></FormState></div>}
      {(reps || []).map((r) => (
        <details key={r.id} className="panel" style={{ opacity: r.active ? 1 : 0.6 }}>
          <summary style={{ cursor: "pointer" }} className="row between">
            <span><strong>{r.name}</strong> <span className="tiny faint">{String(r.day_start).slice(0, 5)}–{String(r.day_end).slice(0, 5)} · {r.modes.map((m) => (m === "field" ? "visits" : "online")).join(" + ")}{r.active ? "" : " · not scheduling"}</span></span>
            {can && <span className="tiny">Edit</span>}
          </summary>
          {can && <div style={{ marginTop: 12 }}><FormState action={saveRep} submit="Save"><RepFields r={r} members={members || []} /></FormState></div>}
        </details>
      ))}
    </>
  );
}
