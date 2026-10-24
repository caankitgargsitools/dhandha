"use client";
import { useState } from "react";
import { findSlots, bookSlot, createBookingLink } from "@/app/app/sales/actions";
import { groupSlots } from "@/lib/scheduling";
import { waLink } from "@/lib/leads";
import { Spinner } from "./Progress";

const dayLabel = (d) => new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

// On a lead: book a meeting now (free times from the team's calendars, travel included for field visits), or send
// the client a link to pick their own time.
export default function BookMeeting({ leadId, types, address: initialAddress, phone, contact, business }) {
  const [typeId, setTypeId] = useState(types[0]?.id || "");
  const [address, setAddress] = useState(initialAddress || "");
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const [link, setLink] = useState(null);
  const type = types.find((t) => t.id === typeId);
  if (!types.length) return <p className="small muted" style={{ margin: 0 }}>Add a meeting type and a salesperson under <a href="/app/sales/types">Sales team</a> to book meetings.</p>;

  async function find() {
    setBusy("find"); setMsg(null); setLink(null);
    const r = await findSlots({ typeId, leadId, address, days: 7 });
    setBusy("");
    if (r.error) { setMsg({ error: r.error }); setRes(null); return; }
    if (r.address && !address) setAddress(r.address);
    setRes(r);
  }
  async function book(slot) {
    setBusy(slot.start);
    const r = await bookSlot({ typeId, leadId, start: slot.start, repId: slot.rep_id, address });
    setBusy("");
    setMsg(r.error ? { error: r.error } : { ok: r.message });
    if (!r.error) setRes(null);
  }
  async function sendLink() {
    setBusy("link"); setMsg(null);
    const r = await createBookingLink({ typeId, leadId, address });
    setBusy("");
    if (r.error) return setMsg({ error: r.error });
    const url = `${window.location.origin}/book/${r.token}`;
    setLink({ url, wa: waLink(phone, `Namaste${contact ? ` ${contact}` : ""}, please pick a convenient time for our ${type?.name?.toLowerCase() || "meeting"}${business ? ` with ${business}` : ""}: ${url}`) });
  }

  return (
    <div className="stack-sm">
      <div className="form-grid">
        <div><label htmlFor="bm-type">Meeting</label>
          <select id="bm-type" value={typeId} onChange={(e) => { setTypeId(e.target.value); setRes(null); }}>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.mode === "field" ? "visit" : "online"} · {t.duration_min} min</option>)}
          </select>
        </div>
        {type?.mode === "field" && <div><label htmlFor="bm-addr">Client's address</label><input id="bm-addr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full address for the visit" /></div>}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="sm" aria-busy={busy === "find"} disabled={!!busy} onClick={find}>Find free times</button>
        <button className="sm ghost" aria-busy={busy === "link"} disabled={!!busy} onClick={sendLink}>Send booking link</button>
      </div>
      {busy === "find" && <Spinner label={type?.mode === "field" ? "Checking every salesperson's route and travel times…" : "Checking everyone's calendar…"} />}
      {msg?.error && <p className="error small" style={{ margin: 0 }}>{msg.error}</p>}
      {msg?.ok && <p className="success small" style={{ margin: 0 }}>{msg.ok}</p>}
      {link && (
        <div className="notice info small" style={{ display: "block" }}>
          <div>Booking link ready — the client picks a time, and the meeting is booked with a free salesperson.</div>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <input readOnly value={link.url} onFocus={(e) => e.target.select()} style={{ flex: 1, minWidth: 180 }} aria-label="Booking link" />
            <button className="sm ghost" onClick={() => navigator.clipboard?.writeText(link.url)}>Copy</button>
            {link.wa && <a className="btn sm" href={link.wa} target="_blank" rel="noreferrer">Send on WhatsApp</a>}
          </div>
        </div>
      )}
      {res && (
        <div className="stack-sm">
          {res.estimated && <p className="tiny faint" style={{ margin: 0 }}>Some drive times are estimates (45 min) — Google could not price every trip.</p>}
          {!res.slots.length && <p className="small muted" style={{ margin: 0 }}>No free times in the next 7 days.</p>}
          {groupSlots(res.slots.map((x) => ({ ...x, start: new Date(x.start) }))).map((g) => (
            <div key={g.day}>
              <div className="tiny" style={{ fontWeight: 600, margin: "6px 0 4px" }}>{dayLabel(g.day)}</div>
              {Object.entries(g.parts).filter(([, l]) => l.length).map(([part, list]) => (
                <div key={part} className="row" style={{ gap: 6, marginBottom: 4 }}>
                  <span className="tiny faint" style={{ width: 66 }}>{part}</span>
                  {list.slice(0, 12).map((x) => (
                    <button key={x.start.toISOString()} className="sm ghost" aria-busy={busy === x.start.toISOString()} disabled={!!busy} onClick={() => book({ ...x, start: x.start.toISOString() })}
                      title={`${x.rep}${x.travel_in ? ` · ${x.travel_in} min drive` : ""}`}>{x.label}</button>
                  ))}
                </div>
              ))}
            </div>
          ))}
          {res.slots.length > 0 && <p className="tiny faint" style={{ margin: 0 }}>Tap a time to book it. Hover shows who and the drive.</p>}
        </div>
      )}
    </div>
  );
}
