"use client";
import { useState } from "react";
import { bookByToken } from "./actions";
import { groupSlots } from "@/lib/scheduling";

const dayLabel = (d) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

// The client picks a day, then a time in the part of the day they prefer.
export default function Picker({ token, slots, contact, mode }) {
  const groups = groupSlots(slots.map((s) => ({ ...s, start: new Date(s.start) })));
  const [day, setDay] = useState(groups[0]?.day || null);
  const [pick, setPick] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState(null);
  if (out?.ok) return (
    <div className="notice info" style={{ display: "block" }}>
      <strong>Booked — thank you{contact ? `, ${contact}` : ""}!</strong>
      <div className="small">{new Date(out.start).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })}{mode === "field" ? " — we will come to you." : " — you will get the call / meeting link before the time."}</div>
    </div>
  );
  if (!groups.length) return <p className="muted" style={{ margin: 0 }}>No free times are left on this link. Please ask for a new one.</p>;
  const g = groups.find((x) => x.day === day) || groups[0];
  async function confirm() {
    setBusy(true);
    const r = await bookByToken({ token, start: pick, note });
    setBusy(false);
    setOut(r);
  }
  return (
    <div className="stack-sm">
      <p className="small" style={{ margin: 0 }}>{contact ? `Hello ${contact}, p` : "P"}ick a day and a time that suits you.</p>
      <div className="row" style={{ gap: 6, overflowX: "auto", flexWrap: "nowrap", paddingBottom: 4 }}>
        {groups.map((x) => <button key={x.day} className={`sm ${x.day === g.day ? "" : "ghost"}`} onClick={() => { setDay(x.day); setPick(null); }} style={{ whiteSpace: "nowrap" }}>{dayLabel(x.day)}</button>)}
      </div>
      {Object.entries(g.parts).filter(([, l]) => l.length).map(([part, list]) => (
        <div key={part}>
          <div className="tiny faint" style={{ margin: "6px 0 4px" }}>{part}</div>
          <div className="row" style={{ gap: 6 }}>
            {list.map((x) => { const iso = x.start.toISOString(); return <button key={iso} className={`sm ${pick === iso ? "" : "ghost"}`} onClick={() => setPick(iso)}>{x.label}</button>; })}
          </div>
        </div>
      ))}
      {pick && (
        <div className="stack-sm">
          <div><label htmlFor="bk-note">Anything we should know? (optional)</label><input id="bk-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={mode === "field" ? "Landmark, floor, whom to ask for…" : "Topic, best number to call…"} /></div>
          <div><button aria-busy={busy} disabled={busy} onClick={confirm}>Confirm {new Date(pick).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", hour: "numeric", minute: "2-digit" })}</button></div>
        </div>
      )}
      {out?.error && <p className="error small" style={{ margin: 0 }}>{out.error}</p>}
    </div>
  );
}
