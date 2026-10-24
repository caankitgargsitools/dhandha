"use client";
import { useState } from "react";

// A list of words as tags: × removes one, the box adds one (Enter or comma also adds). Posts them comma-separated
// under `name`, so server actions read it like the old text box.
export default function WordChips({ name, label, initial = [], placeholder, hint, empty = "None yet." }) {
  const [words, setWords] = useState(initial);
  const [draft, setDraft] = useState("");
  const add = () => {
    const parts = draft.split(",").map((w) => w.trim()).filter(Boolean);
    if (!parts.length) return;
    setWords((ws) => [...ws, ...parts.filter((p) => !ws.some((w) => w.toLowerCase() === p.toLowerCase()))]);
    setDraft("");
  };
  return (
    <div className="stack-sm">
      <label htmlFor={`${name}-add`}>{label}</label>
      <input type="hidden" name={name} value={words.join(", ")} />
      <div className="row" style={{ gap: 6 }}>
        {!words.length && <span className="tiny faint">{empty}</span>}
        {words.map((w) => (
          <span key={w} className="chip info" style={{ gap: 6 }}>{w}
            <button type="button" onClick={() => setWords((ws) => ws.filter((x) => x !== w))} aria-label={`Remove ${w}`} title="Remove"
              style={{ padding: 0, border: 0, background: "none", color: "inherit", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
      <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
        <input id={`${name}-add`} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }} />
        <button type="button" className="sm ghost" onClick={add} disabled={!draft.trim()}>Add</button>
      </div>
      {hint && <div className="tiny faint">{hint}</div>}
    </div>
  );
}
