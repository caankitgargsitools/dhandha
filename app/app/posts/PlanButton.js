"use client";
import { useActionState } from "react";
import { planThisMonth } from "./actions";

export default function PlanButton({ month }) {
  const [st, act, pending] = useActionState(planThisMonth, {});
  return (
    <form action={act} className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input type="hidden" name="month" value={month} />
      <button className="sm" aria-busy={pending} disabled={pending}>Plan this month (free drafts)</button>
      {st?.error && <span className="error small">{st.error}</span>}
      {st?.message && <span className="success small">{st.message}</span>}
    </form>
  );
}
