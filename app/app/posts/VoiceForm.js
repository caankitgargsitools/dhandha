"use client";
import { useActionState } from "react";
import { saveVoice } from "./actions";
import { CHANNELS, TONES } from "@/lib/contentPlan";

export default function VoiceForm({ v = {}, canEdit }) {
  const [st, act, pending] = useActionState(saveVoice, {});
  const ch = new Set(v.channels || ["google", "linkedin", "facebook", "whatsapp"]);
  return (
    <form action={act} className="stack-sm">
      <div className="form-grid">
        <div><label htmlFor="tone">Tone</label><select id="tone" name="tone" defaultValue={v.tone || "friendly"} disabled={!canEdit}>{Object.entries(TONES).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></div>
        <div><label htmlFor="per_week">Posts a week</label><input id="per_week" name="per_week" type="number" min="1" max="7" defaultValue={v.per_week || 3} disabled={!canEdit} /></div>
        <div><label htmlFor="audience">Who you talk to</label><input id="audience" name="audience" defaultValue={v.audience || ""} placeholder="Govt departments, factory owners in Haryana" disabled={!canEdit} /></div>
      </div>
      <div><label htmlFor="about">About you in one line</label><input id="about" name="about" defaultValue={v.about || ""} placeholder="25 years of audits for PSUs and departments" disabled={!canEdit} /></div>
      <div className="form-grid">
        <div><label htmlFor="say">Words you like</label><input id="say" name="say_words" defaultValue={v.say_words || ""} placeholder="trusted, on time" disabled={!canEdit} /></div>
        <div><label htmlFor="avoid">Words to avoid</label><input id="avoid" name="avoid_words" defaultValue={v.avoid_words || ""} placeholder="cheap, guaranteed" disabled={!canEdit} /></div>
        <div><label htmlFor="tags">Your hashtags</label><input id="tags" name="hashtags" defaultValue={v.hashtags || ""} placeholder="#audit #gurugram" disabled={!canEdit} /></div>
      </div>
      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        {Object.entries(CHANNELS).map(([k, c]) => <label key={k} className="small row" style={{ gap: 5, margin: 0 }}><input type="checkbox" name="channels" value={k} defaultChecked={ch.has(k)} disabled={!canEdit} /> {c.label}</label>)}
        <label className="small row" style={{ gap: 5, margin: 0 }}><input type="checkbox" name="hindi" defaultChecked={(v.languages || []).includes("hi")} disabled={!canEdit} /> A Hindi line is welcome</label>
      </div>
      {st?.error && <p className="error small" role="alert">{st.error}</p>}
      {st?.message && <p className="success small" role="status">{st.message}</p>}
      {canEdit && <div><button className="sm" aria-busy={pending} disabled={pending}>Save brand voice</button></div>}
    </form>
  );
}
