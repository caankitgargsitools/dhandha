"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { bookByToken } from "./actions";
import { groupSlots } from "@/lib/scheduling";

const dayLabel = (d) => new Date(`${d}T12:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "short" });

// The client picks a date (only dates with a free time are listed), then a free time. Times are the whole
// company's; who takes the meeting is decided when they book.
export default function Picker({ token, slots, contact, mode }) {
  const groups = groupSlots(slots.map((s) => ({ ...s, start: new Date(s.start) })));
  const [day, setDay] = useState(groups[0]?.day || null);
  const [pick, setPick] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState(null);
  const router = useRouter();
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
    // the time was just taken (or the link changed): load the free times again and ask for a new pick
    if (r?.error) { setPick(null); router.refresh(); }
  }
  return (
    <div className="stack-sm">
      <p className="small" style={{ margin: 0 }}>{contact ? `Hello ${contact}, p` : "P"}ick a date, then a time that suits you.</p>
      <div><label htmlFor="bk-day">Date</label>
        <select id="bk-day" value={g.day} onChange={(e) => { setDay(e.target.value); setPick(null); }}>
          {groups.map((x) => { const n = Object.values(x.parts).reduce((t, l) => t + l.length, 0); return <option key={x.day} value={x.day}>{dayLabel(x.day)} — {n} free time{n === 1 ? "" : "s"}</option>; })}
        </select></div>
      <div><label>Time</label>
        {Object.entries(g.parts).filter(([, l]) => l.length).map(([part, list]) => (
          <div key={part}>
            <div className="tiny faint" style={{ margin: "6px 0 4px" }}>{part}</div>
            <div className="row" style={{ gap: 6 }}>
              {list.map((x) => { const iso = x.start.toISOString(); return <button key={iso} className={`sm ${pick === iso ? "" : "ghost"}`} aria-pressed={pick === iso} onClick={() => setPick(iso)}>{x.label}</button>; })}
            </div>
          </div>
        ))}
      </div>
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
