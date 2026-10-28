"use client";
import { useActionState, useState } from "react";
import { moveDeal } from "./actions";

// Move a deal on the board. Lost needs a reason; errors show under the form.
export default function MoveDeal({ id, stage, title, stages }) {
  const [state, formAction, pending] = useActionState(moveDeal, {});
  const [to, setTo] = useState(stage);
  return (
    <form action={formAction} className="stack-sm" style={{ marginTop: 8, gap: 6 }}>
      <input type="hidden" name="id" value={id} />
      <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
        <select name="stage" value={to} onChange={(e) => setTo(e.target.value)} aria-label={`Move ${title}`} style={{ padding: "4px 8px", fontSize: 12 }}>
          {stages.map(([s, l]) => <option key={s} value={s}>{l}</option>)}
        </select>
        <button className="ghost sm" disabled={pending} aria-busy={pending}>Move</button>
      </div>
      {to === "lost" && <input name="lost_reason" required maxLength={200} placeholder="Why was it lost?" aria-label="Why was it lost" style={{ padding: "4px 8px", fontSize: 12 }} />}
      {state?.error && <p className="error tiny" style={{ margin: 0 }}>{state.error}</p>}
    </form>
  );
}
