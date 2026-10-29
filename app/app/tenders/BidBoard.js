"use client";
import { useState, useTransition } from "react";
import { makeBidPlan, setBidTask, signOff } from "./boardActions";
import { SIGNOFFS, signoffState } from "@/lib/bidPlan";

const when = (d) => (d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "");
const CAN_SIGN = { technical: ["admin", "manager", "bid_preparer"], finance: ["admin", "manager"], management: ["admin"] };

// The bid's task list (dated back from the closing time) and the three sign-offs before filing.
export default function BidBoard({ matchId, board, members, role, canEdit }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState(null);
  const run = (fn) => start(async () => { setMsg(null); const r = await fn(); if (r?.error) setMsg(r.error); });
  const tasks = board?.tasks || [];
  const sign = signoffState(board?.signoffs || []);
  const done = tasks.filter((t) => t.status === "done").length;
  const now = Date.now();
  return (
    <div className="stack-sm">
      {!tasks.length ? (
        <div className="row" style={{ gap: 8 }}>
          <span className="small muted">Plan this bid: ten usual steps dated back from the closing time, each with an owner.</span>
          {canEdit && <button type="button" className="sm" disabled={pending} aria-busy={pending} onClick={() => run(() => makeBidPlan(matchId))}>Make the bid plan</button>}
        </div>
      ) : (
        <>
          <div className="tiny faint">{done} of {tasks.length} done</div>
          {tasks.map((t) => {
            const late = t.status !== "done" && t.due_at && new Date(t.due_at).getTime() < now;
            return (
              <div key={t.id} className="row" style={{ gap: 8, flexWrap: "nowrap", alignItems: "flex-start", opacity: t.status === "done" ? 0.6 : 1 }}>
                <input type="checkbox" checked={t.status === "done"} disabled={!canEdit || pending} onChange={(e) => run(() => setBidTask(matchId, t.id, e.target.checked ? "done" : "todo"))} style={{ width: "auto", marginTop: 3 }} aria-label={t.title} />
                <div style={{ flex: 1 }}>
                  <div className="small" style={{ textDecoration: t.status === "done" ? "line-through" : "none" }}>{t.title}</div>
                  <div className="tiny" style={{ color: late ? "var(--blood)" : "var(--ink-3)" }}>{when(t.due_at)}{late ? " · late" : ""}{t.details ? ` · ${t.details}` : ""}</div>
                </div>
                {canEdit ? (
                  <select value={t.assigned_to || ""} disabled={pending} onChange={(e) => run(() => setBidTask(matchId, t.id, t.status, e.target.value))} style={{ width: 140, fontSize: 12 }} aria-label="Owner">
                    {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
                  </select>
                ) : <span className="tiny faint">{t.who}</span>}
              </div>
            );
          })}
        </>
      )}
      <div className="stack-sm" style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 8 }}>
        <strong className="small">Sign-offs before filing</strong>
        {SIGNOFFS.map(([step, label]) => {
          const s = sign[step];
          return (
            <div key={step} className="row between small" style={{ gap: 8 }}>
              <span>{label}: {s ? <span className={`chip ${s.decision === "approved" ? "ok" : "warn"}`}>{s.decision === "approved" ? "Approved" : "Changes asked"}</span> : <span className="chip mute">Waiting</span>}{s ? <span className="tiny faint"> {s.who}{s.note ? ` — ${s.note}` : ""}</span> : null}</span>
              {CAN_SIGN[step].includes(role) && (
                <span className="row" style={{ gap: 4 }}>
                  <button type="button" className="sm ghost" disabled={pending} onClick={() => run(() => signOff(matchId, step, "approved", note))}>Approve</button>
                  <button type="button" className="sm ghost" disabled={pending} onClick={() => run(() => signOff(matchId, step, "changes", note))}>Ask changes</button>
                </span>
              )}
            </div>
          );
        })}
        {["admin", "manager", "bid_preparer"].includes(role) && <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note with your sign-off (optional)" maxLength={500} />}
      </div>
      {msg && <p className="error small" style={{ margin: 0 }}>{msg}</p>}
    </div>
  );
}
