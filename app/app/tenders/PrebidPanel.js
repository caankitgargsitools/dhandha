"use client";
import { useState, useTransition } from "react";
import { draftPrebidFree, draftPrebidAi, savePrebid } from "./prebidActions";
import { queriesText } from "@/lib/prebid";
import { TimedProgress } from "@/components/Progress";

// Pre-bid queries for one tender: free draft from the eligibility gaps, optional AI read of the whole tender,
// edit, copy as text for the department's format or email.
export default function PrebidPanel({ matchId, initial = [], prebidOn, firm, tender, canEdit }) {
  const [qs, setQs] = useState(initial);
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(null);
  const [, start] = useTransition();
  const run = (kind, fn) => { setBusy(kind); setNote(null); start(async () => { const r = await fn(); setBusy(null); if (r.error) setNote(r.error); else if (r.queries) setQs(r.queries); else setNote("Saved."); }); };
  const set = (i, k, v) => setQs((x) => x.map((q, j) => (j === i ? { ...q, [k]: v } : q)));
  return (
    <div className="stack-sm">
      <p className="small muted" style={{ margin: 0 }}>{prebidOn ? `Pre-bid meeting / query date: ${prebidOn}. ` : ""}Ask the department to clarify or relax conditions before you bid — relaxed criteria often let a firm qualify. Your phone is reminded the day before the pre-bid meeting.</p>
      {qs.map((q, i) => (
        <div key={i} className="panel" style={{ margin: 0, padding: 10 }}>
          <div className="row between tiny faint"><span>{i + 1}. {q.clause}{q.page ? ` · page ${q.page}` : ""}</span><span>{q.source === "ai" ? "AI" : q.source === "free" ? "From your eligibility" : "Yours"}</span></div>
          {q.says && <div className="tiny" style={{ margin: "4px 0" }}>Tender says: {q.says}</div>}
          {canEdit ? <textarea rows={2} value={q.query} onChange={(e) => set(i, "query", e.target.value)} maxLength={800} /> : <div className="small">{q.query}</div>}
          {q.why && <div className="tiny faint">Reason: {q.why}</div>}
          {canEdit && <button type="button" className="sm ghost" onClick={() => setQs((x) => x.filter((_, j) => j !== i))}>Remove</button>}
        </div>
      ))}
      {canEdit && (
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="sm" disabled={!!busy} aria-busy={busy === "free"} onClick={() => run("free", () => draftPrebidFree(matchId))}>Draft from my eligibility (free)</button>
          <button type="button" className="sm ghost" disabled={!!busy} aria-busy={busy === "ai"} onClick={() => run("ai", () => draftPrebidAi(matchId))}>Read the tender with AI · 5 credits</button>
          <button type="button" className="sm ghost" disabled={!!busy} onClick={() => setQs((x) => [...x, { clause: "", says: "", query: "", why: "", source: "you" }])}>+ Add my own</button>
          {qs.length > 0 && <button type="button" className="sm ghost" disabled={!!busy} aria-busy={busy === "save"} onClick={() => run("save", () => savePrebid(matchId, qs))}>Save</button>}
          {qs.length > 0 && <button type="button" className="sm ghost" onClick={() => navigator.clipboard?.writeText(queriesText(qs, { firm, tender }))}>Copy as text</button>}
        </div>
      )}
      {busy === "ai" && <TimedProgress seconds={60} label="Reading the tender" />}
      {note && <p className="small" style={{ margin: 0 }}>{note}</p>}
    </div>
  );
}
