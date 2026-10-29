"use client";
import { useState, useTransition } from "react";
import { saveLesson } from "./actions";

// a tried answer for an objection that keeps losing calls: edit, then save as a lesson for every call
export default function SuggestLesson({ s }) {
  const [better, setBetter] = useState(s.better);
  const [done, setDone] = useState(null);
  const [pending, start] = useTransition();
  if (done === true) return <p className="small" style={{ margin: 0, color: "var(--ok)" }}>Saved — Dhandha AI uses it from the next call.</p>;
  return (
    <div className="stack-sm">
      <textarea rows={2} value={better} onChange={(e) => setBetter(e.target.value)} maxLength={1000} />
      <div className="row" style={{ gap: 6 }}>
        <button type="button" className="sm" disabled={pending || !better.trim()} aria-busy={pending} onClick={() => start(async () => { const r = await saveLesson({ kind: "example", scope: "company", situation: s.situation, better }); setDone(r.error ? r.error : true); })}>Add as a lesson</button>
        {typeof done === "string" && <span className="error small">{done}</span>}
      </div>
    </div>
  );
}
