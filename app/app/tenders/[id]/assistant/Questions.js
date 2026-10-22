"use client";
import { useState } from "react";

// Answer widgets for the assistant's master questions. Each calls `send(myText, action)`; the assistant shows
// the answer as the person's bubble, saves it to the masters and moves to the next question.

export function MasterAnswer({ step, busy, send, skip }) {
  const [v, setV] = useState("");
  const submit = (e) => { e.preventDefault(); send(step.options ? step.options[v] : v, v); };
  if (step.options) {
    return (
      <div className="row" style={{ gap: 6 }}>
        {Object.entries(step.options).map(([k, l]) => <button key={k} className="sm ghost" disabled={busy} onClick={() => send(l, k)}>{l}</button>)}
        <button className="sm ghost" disabled={busy} onClick={skip}>Skip</button>
      </div>
    );
  }
  const money = step.type === "money";
  return (
    <form className="row" style={{ gap: 8, flexWrap: "nowrap" }} onSubmit={submit}>
      {step.long ? <textarea value={v} onChange={(e) => setV(e.target.value)} rows={2} autoFocus style={{ flex: 1 }} aria-label={step.label} />
        : <input value={v} onChange={(e) => setV(money ? e.target.value.replace(/[^\d.]/g, "") : e.target.value)} autoFocus aria-label={step.label} placeholder={step.hint || (money ? "Amount in rupees" : "")}
          type={step.type === "date" ? "date" : step.type === "email" ? "email" : "text"} inputMode={money || step.type === "tel" ? "numeric" : undefined} style={{ flex: 1, width: "auto" }} />}
      {money && Number(v) > 0 && <span className="tiny faint" style={{ alignSelf: "center", whiteSpace: "nowrap" }}>₹{Number(v).toLocaleString("en-IN")}</span>}
      <button disabled={busy || !String(v).trim()}>Send</button>
      <button type="button" className="ghost" disabled={busy} onClick={skip}>Skip</button>
    </form>
  );
}

// One completed work (name, client, value, completion date): a single record, not a table.
export function WorkAnswer({ busy, send, skip }) {
  const [w, setW] = useState({ work_name: "", client: "", value_inr: "", end_date: "" });
  const f = (k) => (e) => setW({ ...w, [k]: k === "value_inr" ? e.target.value.replace(/[^\d.]/g, "") : e.target.value });
  return (
    <form className="stack-sm" onSubmit={(e) => { e.preventDefault(); send(`${w.work_name} for ${w.client}, ₹${Number(w.value_inr || 0).toLocaleString("en-IN")}${w.end_date ? `, completed ${w.end_date}` : ""}`, w); }}>
      <div className="form-grid">
        <div><label htmlFor="wn">What was the work?</label><input id="wn" value={w.work_name} onChange={f("work_name")} autoFocus /></div>
        <div><label htmlFor="wc">For which client?</label><input id="wc" value={w.client} onChange={f("client")} /></div>
        <div><label htmlFor="wv">Contract value (₹)</label><input id="wv" inputMode="numeric" value={w.value_inr} onChange={f("value_inr")} /></div>
        <div><label htmlFor="we">Completed on</label><input id="we" type="date" value={w.end_date} onChange={f("end_date")} /></div>
      </div>
      <div className="row" style={{ gap: 8 }}><button disabled={busy || !w.work_name || !w.client || !w.value_inr}>Save this work</button><button type="button" className="ghost" disabled={busy} onClick={skip}>Skip</button></div>
    </form>
  );
}

export function PersonAnswer({ busy, send, skip }) {
  const [p, setP] = useState({ name: "", designation: "", qualification: "", years: "", membership_no: "", pan: "" });
  const f = (k) => (e) => setP({ ...p, [k]: e.target.value });
  return (
    <form className="stack-sm" onSubmit={(e) => { e.preventDefault(); send(`${p.name}${p.designation ? `, ${p.designation}` : ""}${p.qualification ? ` (${p.qualification})` : ""}${p.years ? `, ${p.years} years` : ""}`, p); }}>
      <div className="form-grid">
        <div><label htmlFor="pnm">Name</label><input id="pnm" value={p.name} onChange={f("name")} autoFocus /></div>
        <div><label htmlFor="pds">Designation</label><input id="pds" value={p.designation} onChange={f("designation")} /></div>
        <div><label htmlFor="pq">Qualification</label><input id="pq" value={p.qualification} onChange={f("qualification")} placeholder="e.g. FCA, B.E. Civil" /></div>
        <div><label htmlFor="py">Years of experience</label><input id="py" inputMode="numeric" value={p.years} onChange={f("years")} /></div>
        <div><label htmlFor="pm">Membership no. (ICAI etc.)</label><input id="pm" value={p.membership_no} onChange={f("membership_no")} /></div>
        <div><label htmlFor="pp">PAN</label><input id="pp" value={p.pan} onChange={f("pan")} placeholder="ABCDE1234F" /></div>
      </div>
      <div className="row" style={{ gap: 8 }}><button disabled={busy || !p.name}>Save this person</button><button type="button" className="ghost" disabled={busy} onClick={skip}>Skip</button></div>
    </form>
  );
}

// The format picker: each of the tender's formats with the best template pre-selected and the alternatives.
export function FormatPicker({ step, busy, send }) {
  const [pick, setPick] = useState(() => Object.fromEntries(step.formats.map((f) => [f.title, f.options[0].kind])));
  const list = step.formats.map((f) => ({ title: f.title, page: f.page, kind: pick[f.title] }));
  const ai = list.filter((x) => x.kind === "custom").length;
  return (
    <div className="stack-sm">
      {step.formats.map((f) => (
        <div key={f.title} style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 8 }}>
          <div className="small"><strong>{f.title}</strong>{f.page ? <span className="faint"> · p. {f.page}</span> : null}</div>
          <div className="row" style={{ gap: 6, marginTop: 4 }}>
            {f.options.map((o, i) => (
              <label key={o.kind} className={`chip ${pick[f.title] === o.kind ? "ok" : "mute"}`} style={{ cursor: "pointer", fontWeight: pick[f.title] === o.kind ? 700 : 400 }}>
                <input type="radio" name={f.title} checked={pick[f.title] === o.kind} onChange={() => setPick({ ...pick, [f.title]: o.kind })} style={{ display: "none" }} />
                {o.label}{i === 0 ? " (best fit)" : ""}
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="row" style={{ gap: 8 }}>
        <button disabled={busy} onClick={() => send(`Use these ${list.length} formats${ai ? ` (${ai} in the tender's own wording)` : ""}`, list)}>Confirm formats</button>
      </div>
    </div>
  );
}
