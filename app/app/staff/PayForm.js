"use client";
import { useActionState } from "react";
import { savePayroll } from "./actions";

const inr = (n) => `₹${(Number(n) || 0).toLocaleString("en-IN")}`;

export default function PayForm({ month, people, lines, final }) {
  const [st, act, pending] = useActionState(savePayroll, {});
  const by = Object.fromEntries((lines || []).map((l) => [l.staff_id, l]));
  return (
    <form action={act} className="stack-sm">
      <input type="hidden" name="month" value={month} />
      <div style={{ overflowX: "auto" }}>
        <table className="small">
          <thead><tr><th>Name</th><th>Paid days</th><th>Advance</th><th>Bonus</th><th>Earned</th><th>PF</th><th>ESI</th><th>PT + TDS</th><th>Net pay</th><th /></tr></thead>
          <tbody>
            {people.map((s) => { const l = by[s.id]; return (
              <tr key={s.id}>
                <td>{s.name}<div className="faint">{s.designation}</div></td>
                <td><input name={`days_${s.id}`} defaultValue={l?.days ?? ""} placeholder="all" inputMode="decimal" style={{ width: 64 }} disabled={final} /></td>
                <td><input name={`adv_${s.id}`} defaultValue={l?.advance || ""} inputMode="numeric" style={{ width: 80 }} disabled={final} /></td>
                <td><input name={`bonus_${s.id}`} defaultValue={l?.bonus || ""} inputMode="numeric" style={{ width: 80 }} disabled={final} /></td>
                <td>{l ? inr(l.earned) : "—"}</td><td>{l ? inr(l.pf_emp) : "—"}</td><td>{l ? inr(l.esi_emp) : "—"}</td><td>{l ? inr(l.pt + l.tds) : "—"}</td>
                <td><strong>{l ? inr(l.net) : "—"}</strong></td>
                <td>{l && <a href={`/app/staff/payslip?m=${month}&s=${s.id}`} target="_blank" rel="noreferrer">Payslip</a>}</td>
              </tr>); })}
          </tbody>
        </table>
      </div>
      {st?.error && <p className="error small" role="alert">{st.error}</p>}
      {st?.message && <p className="success small" role="status">{st.message}</p>}
      {!final && <div><button className="sm" aria-busy={pending} disabled={pending}>Work out pay</button></div>}
    </form>
  );
}
