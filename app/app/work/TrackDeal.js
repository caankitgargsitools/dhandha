"use client";
import { useActionState } from "react";
import { trackDeal } from "./actions";

export default function TrackDeal({ deals }) {
  const [st, act, pending] = useActionState(trackDeal, {});
  if (!deals.length) return null;
  return (
    <form action={act} className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div><label htmlFor="deal_id">Track a won deal as a job</label>
        <select id="deal_id" name="deal_id" required>{deals.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select></div>
      <div><label htmlFor="ws">Starts</label><input id="ws" name="work_start" type="date" /></div>
      <div><label htmlFor="we">Ends</label><input id="we" name="work_end" type="date" /></div>
      <button className="sm" aria-busy={pending} disabled={pending}>Track</button>
      {st?.error && <span className="error small">{st.error}</span>}
    </form>
  );
}
