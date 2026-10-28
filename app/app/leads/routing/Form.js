"use client";
import { useState, useTransition } from "react";
import { saveRouting } from "./actions";

const FIELDS = { city: "City", state: "State", source: "Source", industry: "Industry" };

export default function Form({ initial, members, canEdit }) {
  const [v, setV] = useState(initial);
  const [note, setNote] = useState(null);
  const [pending, start] = useTransition();
  const set = (k, x) => setV((s) => ({ ...s, [k]: x }));
  const toggle = (id) => set("members", v.members.includes(id) ? v.members.filter((m) => m !== id) : [...v.members, id]);
  const setRule = (i, k, x) => set("rules", v.rules.map((r, j) => (j === i ? { ...r, [k]: x } : r)));
  const save = () => start(async () => { const r = await saveRouting(v); setNote(r.error ? { bad: r.error } : { ok: "Saved." }); });
  return (
    <fieldset disabled={!canEdit || pending} style={{ border: 0, padding: 0, margin: 0 }} className="stack">
      <div className="panel stack-sm">
        <div className="grid-2">
          <label>Status<select value={v.enabled ? "1" : "0"} onChange={(e) => set("enabled", e.target.value === "1")}><option value="1">On — new leads get an owner automatically</option><option value="0">Off</option></select></label>
          <label>How to share<select value={v.mode} onChange={(e) => set("mode", e.target.value)}><option value="round_robin">Turn by turn (round-robin)</option><option value="least_open">To whoever has the fewest open leads</option></select></label>
        </div>
        <div>
          <div className="small muted">Share among</div>
          <div className="row" style={{ gap: 6, marginTop: 4 }}>
            {members.map((m) => (
              <label key={m.user_id} className="chip" style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={v.members.includes(m.user_id)} onChange={() => toggle(m.user_id)} style={{ width: "auto", marginRight: 6 }} />{m.name} <span className="tiny faint" style={{ marginLeft: 4 }}>{m.role}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="panel stack-sm">
        <h3 style={{ margin: 0 }}>Rules (checked first)</h3>
        <p className="tiny faint" style={{ margin: 0 }}>e.g. City contains “Jaipur” → Saurabh. The first rule that matches wins; leads no rule matches are shared as above.</p>
        {v.rules.map((r, i) => (
          <div key={i} className="row" style={{ gap: 6 }}>
            <select value={r.field} onChange={(e) => setRule(i, "field", e.target.value)} style={{ width: "auto" }}>{Object.entries(FIELDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <span className="small">contains</span>
            <input value={r.contains} onChange={(e) => setRule(i, "contains", e.target.value)} style={{ maxWidth: 180 }} />
            <span className="small">→</span>
            <select value={r.user} onChange={(e) => setRule(i, "user", e.target.value)} style={{ width: "auto" }}><option value="">pick a person</option>{members.map((m) => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}</select>
            <button type="button" className="ghost sm" onClick={() => set("rules", v.rules.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        <div><button type="button" className="ghost sm" onClick={() => set("rules", [...v.rules, { field: "city", contains: "", user: "" }])}>+ Add a rule</button></div>
      </div>
      <div className="row" style={{ gap: 10 }}>
        <button type="button" onClick={save} aria-busy={pending}>Save</button>
        {note?.bad && <span className="error">{note.bad}</span>}
        {note?.ok && <span className="small" style={{ color: "var(--ok)" }}>{note.ok}</span>}
      </div>
    </fieldset>
  );
}
