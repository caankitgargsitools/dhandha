"use client";
import { useState, useTransition } from "react";
import { saveLesson, replayTurn } from "./actions";
import { Spinner } from "@/components/Progress";

// One call, line by line. Each Dhandha AI line can be replayed with today's lessons or taught: "Should have said…".
export default function Transcript({ call, playbooks, canTeach, focus }) {
  const [open, setOpen] = useState(Number.isInteger(focus) ? focus : null);
  const tr = call.transcript || [];
  return (
    <div className="stack-sm">
      {tr.map((l, i) => (
        <div key={i} id={`line-${i}`} style={{ alignSelf: l.role === "ai" ? "flex-start" : "flex-end", maxWidth: "88%" }}>
          <div className="tiny faint">{l.role === "ai" ? "Dhandha AI" : call.contact || "Client"}{l.at != null ? ` · ${Math.floor(l.at / 60)}:${String(Math.round(l.at % 60)).padStart(2, "0")}` : ""}
            {l.interrupted && <span className="chip warn" style={{ marginLeft: 6 }}>client cut in</span>}
            {l.role === "ai" && i === tr.length - 1 && call.ended_by === "client" && <span className="chip bad" style={{ marginLeft: 6 }}>client hung up after this</span>}
          </div>
          <div className="panel" style={{ padding: "8px 12px", margin: 0, background: l.role === "ai" ? "var(--panel)" : "var(--sheet)" }}>{l.text}</div>
          {l.role === "ai" && canTeach && (open === i
            ? <Teach call={call} idx={i} playbooks={playbooks} onClose={() => setOpen(null)} />
            : <button type="button" className="ghost sm" style={{ marginTop: 4 }} onClick={() => setOpen(i)}>Should have said… / Replay</button>)}
        </div>
      ))}
    </div>
  );
}

function Teach({ call, idx, playbooks, onClose }) {
  const tr = call.transcript;
  const heard = tr[idx - 1]?.role === "client" ? tr[idx - 1].text : "";
  const [l, setL] = useState({
    kind: "example", scope: call.sequence_id ? "playbook" : "company", sequence_id: call.sequence_id || playbooks[0]?.id || "",
    situation: heard ? `the client says "${heard}"` : idx === 0 ? "opening the call" : "", bad: tr[idx].text, better: "",
  });
  const [replay, setReplay] = useState(null);
  const [note, setNote] = useState(null);
  const [pending, start] = useTransition();
  const set = (k, v) => setL((x) => ({ ...x, [k]: v }));
  const run = (withDraft) => start(async () => { setNote(null); setReplay(null); const r = await replayTurn(call.token, idx, withDraft ? l : null); r.error ? setNote({ bad: r.error }) : setReplay(r); });
  const save = () => start(async () => { setNote(null); const r = await saveLesson({ ...l, session: call.token, turn: idx }); r.error ? setNote({ bad: r.error }) : setNote({ ok: "Saved — Dhandha AI uses it from the next call. Replay again to check." }); });

  return (
    <div className="panel stack-sm" style={{ marginTop: 6 }}>
      <div className="grid-2">
        <label>Kind of lesson
          <select value={l.kind} onChange={(e) => set("kind", e.target.value)}>
            <option value="example">A better answer for this moment</option><option value="rule">A rule for every call</option>
          </select></label>
        <label>Use it for
          <select value={l.scope} onChange={(e) => set("scope", e.target.value)}>
            <option value="playbook">One playbook</option><option value="company">Every call of our company</option>
          </select></label>
      </div>
      {l.scope === "playbook" && (
        <label>Playbook<select value={l.sequence_id} onChange={(e) => set("sequence_id", e.target.value)}>{playbooks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      )}
      <label>When<input value={l.situation} onChange={(e) => set("situation", e.target.value)} maxLength={500} placeholder='e.g. the client says "send details" / the client is busy' /></label>
      {l.kind === "example" && <label>Instead of<textarea rows={2} value={l.bad} onChange={(e) => set("bad", e.target.value)} maxLength={1000} /></label>}
      <label>{l.kind === "example" ? "Dhandha AI should say" : "Dhandha AI should"}<textarea rows={3} value={l.better} onChange={(e) => set("better", e.target.value)} maxLength={1000}
        placeholder={l.kind === "example" ? "e.g. Of course. I will have our team send the details on this WhatsApp number today — is that fine?" : "e.g. Never ask for 2 minutes; say the benefit in one line first."} /></label>
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="sm" onClick={save} disabled={pending || !l.better.trim()} aria-busy={pending}>Save lesson</button>
        <button type="button" className="ghost sm" onClick={() => run(true)} disabled={pending || !l.better.trim()}>Try it first (1 credit)</button>
        <button type="button" className="ghost sm" onClick={() => run(false)} disabled={pending}>Replay with saved lessons (1 credit)</button>
        <button type="button" className="ghost sm" onClick={onClose} disabled={pending}>Close</button>
      </div>
      {pending && <Spinner label="Asking Dhandha AI…" />}
      {note?.bad && <p className="error" style={{ margin: 0 }}>{note.bad}</p>}
      {note?.ok && <p className="small" style={{ margin: 0, color: "var(--ok)" }}>{note.ok}</p>}
      {replay && (
        <div className="grid-2">
          <div><div className="tiny faint">It said then</div><div className="small">{replay.original}</div></div>
          <div><div className="tiny faint">It would say now</div><div className="small"><strong>{replay.reply}</strong>{replay.end ? <span className="tiny faint"> (and end the call)</span> : null}</div></div>
        </div>
      )}
      <p className="tiny faint" style={{ margin: 0 }}>Lessons are added to Dhandha AI's instructions on every call — no retraining, works the same day. To hear it, run a test call from the playbook.</p>
    </div>
  );
}
