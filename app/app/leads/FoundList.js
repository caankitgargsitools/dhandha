"use client";
import FormState from "../FormState";
import { addFoundLeads } from "./actions";

// Search results with tick boxes → "Add to leads". Each row carries the lead it would create.
export default function FoundList({ source, rows, note }) {
  if (!rows.length) return null;
  const tick = (on) => (e) => e.currentTarget.closest("form").querySelectorAll("input[name=pick]").forEach((c) => { c.checked = on; });
  return (
    <FormState action={addFoundLeads} submit={`Add ticked to leads${note ? ` · ${note}` : ""}`}>
      <input type="hidden" name="source" value={source} />
      <div className="row" style={{ gap: 6 }}><button type="button" className="ghost sm" onClick={tick(true)}>Tick all {rows.length}</button><button type="button" className="ghost sm" onClick={tick(false)}>Clear</button></div>
      <div className="panel flush table-wrap">
        <table>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}>
                <td style={{ width: 28 }}><input type="checkbox" name="pick" value={JSON.stringify(r)} style={{ width: "auto" }} aria-label={`Add ${r.name}`} /></td>
                <td><strong>{r.name}</strong>{r.contact_person && r.contact_person !== r.name && <div className="small">{r.contact_person}{r._title ? ` — ${r._title}` : ""}</div>}
                  <div className="tiny faint">{r._address || [r.city, r.state].filter(Boolean).join(", ")}</div></td>
                <td className="small">{r.phone || (r.linkedin_url ? <a href={r.linkedin_url} target="_blank" rel="noreferrer">LinkedIn</a> : "—")}{r.website && <div className="tiny"><a href={r.website} target="_blank" rel="noreferrer">website</a></div>}</td>
                <td className="small">{r._rating ? `★ ${r._rating} (${r._reviews})` : r.industry || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </FormState>
  );
}
