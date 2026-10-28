"use client";
import { useState, useTransition } from "react";
import { previewBroadcast, sendBroadcast } from "./actions";

const STATUS = { new: "New", contacted: "Contacted", interested: "Interested", not_interested: "Not interested", converted: "Customer" };

// A WhatsApp broadcast: an approved template to the opted-in leads that match a filter. See who it reaches and what
// it costs before sending; messages go out a few at a time through your own WhatsApp number.
export default function Composer({ sources }) {
  const [f, setF] = useState({ name: "", template: "", lang: "en", statuses: [], sources: [], city: "", min_score: "", since: "" });
  const [preview, setPreview] = useState(null);
  const [note, setNote] = useState(null);
  const [pending, start] = useTransition();
  const set = (k, v) => { setPreview(null); setF((x) => ({ ...x, [k]: v })); };
  const toggle = (k, v) => set(k, f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v]);
  const check = () => start(async () => { setNote(null); const r = await previewBroadcast(f); r.error ? setNote({ bad: r.error }) : setPreview(r); });
  const send = () => {
    if (!confirm(`Send "${f.template}" to ${preview.count} leads on WhatsApp for about ${preview.credits} credits?`)) return;
    start(async () => { const r = await sendBroadcast(f); if (r.error) setNote({ bad: r.error }); else { setNote({ ok: `Queued for ${r.count} leads — they go out over the next minutes.` }); setPreview(null); } });
  };
  return (
    <div className="panel stack-sm">
      <h3 style={{ margin: 0 }}>New broadcast</h3>
      <div className="grid-3">
        <label>Name (for you)<input value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={120} placeholder="e.g. Diwali greetings" /></label>
        <label>Approved template name<input value={f.template} onChange={(e) => set("template", e.target.value.toLowerCase())} placeholder="e.g. festive_offer" /></label>
        <label>Template language<input value={f.lang} onChange={(e) => set("lang", e.target.value)} placeholder="en / hi" /></label>
      </div>
      <div>
        <div className="small muted">Lead status (none ticked = all)</div>
        <div className="row" style={{ gap: 6, marginTop: 4 }}>{Object.entries(STATUS).map(([k, l]) => (
          <label key={k} className="chip" style={{ cursor: "pointer" }}><input type="checkbox" checked={f.statuses.includes(k)} onChange={() => toggle("statuses", k)} style={{ width: "auto", marginRight: 6 }} />{l}</label>))}</div>
      </div>
      <div>
        <div className="small muted">Source (none ticked = all)</div>
        <div className="row" style={{ gap: 6, marginTop: 4 }}>{Object.entries(sources).map(([k, l]) => (
          <label key={k} className="chip" style={{ cursor: "pointer" }}><input type="checkbox" checked={f.sources.includes(k)} onChange={() => toggle("sources", k)} style={{ width: "auto", marginRight: 6 }} />{l}</label>))}</div>
      </div>
      <div className="grid-3">
        <label>City or state contains<input value={f.city} onChange={(e) => set("city", e.target.value)} maxLength={60} /></label>
        <label>Minimum fit score<input type="number" min={0} max={100} value={f.min_score} onChange={(e) => set("min_score", e.target.value)} /></label>
        <label>Leads added since<input type="date" value={f.since} onChange={(e) => set("since", e.target.value)} /></label>
      </div>
      <div className="row" style={{ gap: 10 }}>
        <button type="button" className="ghost" onClick={check} disabled={pending} aria-busy={pending && !preview}>Who will get it?</button>
        {preview && <button type="button" onClick={send} disabled={pending || !preview.count || !f.template} aria-busy={pending}>Send to {preview.count} leads</button>}
      </div>
      {preview && (
        <p className="small" style={{ margin: 0 }}>{preview.count} opted-in lead{preview.count === 1 ? "" : "s"}{preview.count === 2000 ? " (the most in one broadcast)" : ""} · about {preview.credits} credits (you have {Number(preview.balance).toFixed(0)}).
          {preview.sample?.length ? <span className="muted"> e.g. {preview.sample.map((s) => s.name).join(", ")}</span> : null}</p>
      )}
      {note?.bad && <p className="error" style={{ margin: 0 }}>{note.bad}</p>}
      {note?.ok && <p className="small" style={{ margin: 0, color: "var(--ok)" }}>{note.ok}</p>}
      <p className="tiny faint" style={{ margin: 0 }}>Only leads who agreed to WhatsApp, never do-not-disturb. The template is filled with {"{{1}}"} = first name and {"{{2}}"} = your company. Anyone who replies STOP is taken off WhatsApp. Meta also bills your WhatsApp account per conversation.</p>
    </div>
  );
}
