"use client";
import { useState, useTransition } from "react";
import { saveLesson } from "./actions";

// A rule typed in directly (not from a call), e.g. "Always mention we are ICAI peer-reviewed."
export default function NewLesson({ playbooks }) {
  const empty = { kind: "rule", scope: "company", sequence_id: playbooks[0]?.id || "", situation: "", better: "" };
  const [l, setL] = useState(empty);
  const [note, setNote] = useState(null);
  const [pending, start] = useTransition();
  const set = (k, v) => setL((x) => ({ ...x, [k]: v }));
  const save = () => start(async () => { const r = await saveLesson(l); if (r.error) setNote({ bad: r.error }); else { setNote({ ok: "Saved." }); setL(empty); } });
  return (
    <div className="panel stack-sm">
      <h3 style={{ margin: 0 }}>Add a rule</h3>
      <div className="grid-3">
        <label>Use it for<select value={l.scope} onChange={(e) => set("scope", e.target.value)}><option value="company">Every call of our company</option><option value="playbook">One playbook</option></select></label>
        {l.scope === "playbook" && <label>Playbook<select value={l.sequence_id} onChange={(e) => set("sequence_id", e.target.value)}>{playbooks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
        <label>When (optional)<input value={l.situation} onChange={(e) => set("situation", e.target.value)} maxLength={500} placeholder="e.g. the client asks about fees" /></label>
      </div>
      <label>Dhandha AI should<textarea rows={2} value={l.better} onChange={(e) => set("better", e.target.value)} maxLength={1000} placeholder="e.g. Mention that we have served 200+ businesses in Gurugram since 2009." /></label>
      <div className="row" style={{ gap: 10 }}>
        <button type="button" className="sm" onClick={save} disabled={pending || !l.better.trim()} aria-busy={pending}>Save rule</button>
        {note?.bad && <span className="error">{note.bad}</span>}
        {note?.ok && <span className="small" style={{ color: "var(--ok)" }}>{note.ok}</span>}
      </div>
    </div>
  );
}
