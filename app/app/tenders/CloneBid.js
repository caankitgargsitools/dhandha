"use client";
import { useActionState } from "react";
import { cloneBid } from "./cloneActions";

export default function CloneBid({ matchId, options }) {
  const [state, action, pending] = useActionState(cloneBid, {});
  if (!options.length) return null;
  return (
    <form action={action} className="stack-sm">
      <input type="hidden" name="match_id" value={matchId} />
      <div className="row" style={{ gap: 8, alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 220 }}><label htmlFor="clone_from" className="small">Start from a past bid</label>
          <select id="clone_from" name="from_id" defaultValue="">
            <option value="" disabled>Choose a similar bid…</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select></div>
        <button className="sm ghost" aria-busy={pending} disabled={pending}>Copy its formats &amp; costs</button>
      </div>
      {state?.error && <p className="error small" role="alert">{state.error}</p>}
      {state?.message && <p className="success small" role="status">{state.message}</p>}
    </form>
  );
}
