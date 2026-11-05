"use client";
import { useActionState, useState } from "react";
import { saveAward, completeWork } from "./awardActions";

export default function AwardPanel({ m, ps, letter, canEdit }) {
  const [a, aAct, aPend] = useActionState(saveAward, {});
  const [c, cAct, cPend] = useActionState(completeWork, {});
  const [copied, setCopied] = useState(false);
  return (
    <div className="stack-sm">
      <form action={aAct} className="stack-sm">
        <input type="hidden" name="match_id" value={m.id} />
        <div className="form-grid">
          <div><label htmlFor="loa_no">LoA / work order no.</label><input id="loa_no" name="loa_no" defaultValue={m.loa_no || ""} disabled={!canEdit} /></div>
          <div><label htmlFor="loa_date">Dated</label><input id="loa_date" name="loa_date" type="date" defaultValue={m.loa_date || ""} disabled={!canEdit} required /></div>
          <div><label htmlFor="cv">Contract value (₹)</label><input id="cv" name="contract_value" inputMode="numeric" defaultValue={m.contract_value || m.quoted_price || ""} disabled={!canEdit} /></div>
          <div><label htmlFor="ws">Work starts</label><input id="ws" name="work_start" type="date" defaultValue={m.work_start || ""} disabled={!canEdit} /></div>
          <div><label htmlFor="we">Work ends</label><input id="we" name="work_end" type="date" defaultValue={m.work_end || ""} disabled={!canEdit} /></div>
        </div>
        {ps && <div className="tiny faint">Performance security: {ps.pct}% = ₹{ps.amount.toLocaleString("en-IN")}{ps.due ? `, due by ${ps.due}` : " (due about 21 days from the LoA)"}{ps.months ? `, valid ${ps.months} months` : ""}.</div>}
        {a?.error && <p className="error small" role="alert">{a.error}</p>}
        {a?.message && <p className="success small" role="status">{a.message}</p>}
        {canEdit && <div><button className="sm" aria-busy={aPend} disabled={aPend}>{m.loa_date ? "Save" : "Save and make the tasks"}</button></div>}
      </form>
      <div className="tiny faint">Running bills: raise each one in <a href="/app/crm/invoices">Invoices</a> (GST, payments and reminders are tracked there).</div>
      {m.experience_id ? (
        <div className="notice ok small" style={{ margin: 0 }}>Completed on {m.completed_on} — in Vault → Experience.</div>
      ) : canEdit && m.loa_date && (
        <form action={cAct} className="row" style={{ gap: 8, borderTop: "1px solid var(--line-soft)", paddingTop: 10 }}>
          <input type="hidden" name="match_id" value={m.id} />
          <div><label htmlFor="cdone">Work completed on</label><input id="cdone" name="completed_on" type="date" required /></div>
          <button className="sm ghost" aria-busy={cPend} disabled={cPend} style={{ alignSelf: "flex-end" }}>Mark completed → add to Experience</button>
        </form>
      )}
      {c?.error && <p className="error small" role="alert">{c.error}</p>}
      {c?.message && <p className="success small" role="status">{c.message}</p>}
      {m.loa_date && (
        <details>
          <summary className="small">Completion certificate request letter</summary>
          <pre className="small" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: "8px 0" }}>{letter}</pre>
          <button type="button" className="ghost sm" onClick={() => { navigator.clipboard?.writeText(letter); setCopied(true); }}>{copied ? "Copied" : "Copy the letter"}</button>
        </details>
      )}
    </div>
  );
}
