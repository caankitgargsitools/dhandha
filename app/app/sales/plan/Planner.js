"use client";
import { useState } from "react";
import { planDay, bookPlan } from "../actions";
import { Spinner } from "@/components/Progress";
import { directionsUrl } from "@/lib/scheduling";

const time = (iso) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });

// Pick a day and the clients to visit → a route per salesperson (who goes where, in what order, when to leave).
export default function Planner({ leads, types, today }) {
  const [day, setDay] = useState(today);
  const [typeId, setTypeId] = useState(types[0]?.id || "");
  const [picked, setPicked] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const [res, setRes] = useState(null);
  const [done, setDone] = useState(null);
  if (!types.length) return <p className="small muted">Add a field-visit meeting type under Meeting types first.</p>;
  const shown = leads.filter((l) => !q || `${l.name} ${l.address}`.toLowerCase().includes(q.toLowerCase())).slice(0, 80);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 12 ? p : [...p, id]));

  async function plan() {
    setBusy("plan"); setDone(null);
    setRes(await planDay({ day, typeId, leadIds: picked }));
    setBusy("");
  }
  async function book() {
    setBusy("book");
    const r = await bookPlan({ day, typeId, leadIds: picked });
    setBusy("");
    if (r.error) return setRes({ ...res, error: r.error });
    setDone(r); setRes(null); setPicked([]);
  }
  const byRep = {};
  for (const p of res?.plan || []) (byRep[p.rep] ||= []).push(p);

  return (
    <div className="stack">
      <div className="panel stack-sm">
        <div className="form-grid">
          <div><label htmlFor="pl-day">Day</label><input id="pl-day" type="date" value={day} min={today} onChange={(e) => { setDay(e.target.value); setRes(null); }} /></div>
          <div><label htmlFor="pl-type">Visit type</label><select id="pl-type" value={typeId} onChange={(e) => { setTypeId(e.target.value); setRes(null); }}>{types.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.duration_min} min + {t.buffer_min} min break</option>)}</select></div>
          <div><label htmlFor="pl-q">Find clients</label><input id="pl-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or area" /></div>
        </div>
        <div className="tiny faint">{picked.length}/12 ticked · only leads with an address are listed</div>
        <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 10 }}>
          {!shown.length && <p className="small muted" style={{ padding: 12, margin: 0 }}>No leads with an address yet.</p>}
          {shown.map((l) => (
            <label key={l.id} className="row" style={{ gap: 10, padding: "8px 12px", margin: 0, borderTop: "1px solid var(--line-soft)", fontWeight: 400, flexWrap: "nowrap" }}>
              <input type="checkbox" checked={picked.includes(l.id)} onChange={() => toggle(l.id)} style={{ width: "auto" }} />
              <span><strong className="small">{l.name}</strong><br /><span className="tiny faint">{l.address}</span></span>
            </label>
          ))}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button disabled={!picked.length || !!busy} aria-busy={busy === "plan"} onClick={plan}>Plan the route</button>
          {busy === "plan" && <Spinner label="Getting drive times between every stop and sharing the visits out…" />}
        </div>
      </div>

      {res?.error && <p className="error" style={{ margin: 0 }}>{res.error}</p>}
      {done && <div className="notice info"><span><strong>{done.booked} visit{done.booked === 1 ? "" : "s"} booked.</strong> Each salesperson's day is on the Team calendar and in “My day”; the CRM is updated.{done.unplaced?.length ? ` Could not fit: ${done.unplaced.join(", ")}.` : ""}</span></div>}
      {res?.plan && (
        <div className="stack-sm">
          {!res.plan.length && <p className="muted">None of these visits fits that day — try another day or fewer visits.</p>}
          {Object.entries(byRep).map(([rep, stops]) => (
            <div key={rep} className="panel stack-sm">
              <div className="row between"><strong>{rep}</strong><span className="tiny faint">{stops.length} visit{stops.length === 1 ? "" : "s"} · {stops.reduce((t, s) => t + s.travel_in, 0)} min driving to them</span></div>
              <ol style={{ margin: 0, paddingLeft: 20 }} className="stack-sm">
                {stops.map((s) => (
                  <li key={s.lead_id} className="small">
                    <strong className="num">{time(s.start)}–{time(s.end)}</strong> · {s.lead} <span className="tiny faint">· leave {time(s.leave_at)}, {s.travel_in} min drive · <a href={directionsUrl(null, s.address)} target="_blank" rel="noreferrer">map</a></span>
                    <div className="tiny faint">{s.address}</div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
          {res.unplaced?.length > 0 && <p className="small" style={{ margin: 0 }}><strong>Does not fit that day:</strong> {res.unplaced.join(", ")}</p>}
          {res.estimated && <p className="tiny faint" style={{ margin: 0 }}>Some drive times are estimates (45 min).{res.travelError ? ` Google said: ${res.travelError}` : ""}</p>}
          {res.plan.length > 0 && <div className="row" style={{ gap: 8 }}><button className="gold" disabled={!!busy} aria-busy={busy === "book"} onClick={book}>Book all {res.plan.length} visits</button>{busy === "book" && <Spinner label="Re-checking calendars and booking…" />}</div>}
        </div>
      )}
    </div>
  );
}
