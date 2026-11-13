"use client";
import { useActionState } from "react";
import { saveStaff } from "./actions";

export default function StaffForm({ s = {} }) {
  const [st, act, pending] = useActionState(saveStaff, {});
  const F = (n, l, p = {}) => <div><label htmlFor={`sf-${n}`}>{l}</label><input id={`sf-${n}`} name={n} defaultValue={s[n] ?? ""} {...p} /></div>;
  return (
    <form action={act} className="stack-sm">
      {s.id && <input type="hidden" name="id" value={s.id} />}
      <div className="form-grid">{F("name", "Name", { required: true })}{F("designation", "Designation")}{F("phone", "Phone", { inputMode: "tel" })}</div>
      <div className="form-grid">{F("gross", "Monthly gross pay (₹)", { inputMode: "numeric", required: true })}{F("basic_pct", "Basic as % of gross", { inputMode: "numeric", placeholder: "50" })}{F("joined_on", "Joined on", { type: "date" })}</div>
      <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
        <label className="small row" style={{ gap: 6, margin: 0 }}><input type="checkbox" name="pf" defaultChecked={s.pf ?? true} /> PF</label>
        <label className="small row" style={{ gap: 6, margin: 0 }}><input type="checkbox" name="esi" defaultChecked={s.esi ?? true} /> ESI (applies only up to ₹21,000 gross)</label>
      </div>
      <div className="form-grid">{F("pt", "Professional tax a month (₹)", { inputMode: "numeric", placeholder: "0" })}{F("tds", "TDS a month (₹)", { inputMode: "numeric", placeholder: "0" })}{F("left_on", "Left on", { type: "date" })}</div>
      <div className="form-grid">{F("pan", "PAN")}{F("uan", "UAN (PF)")}{F("esic_no", "ESIC no.")}</div>
      <div className="form-grid">{F("bank_name", "Bank")}{F("bank_account", "Account no.", { inputMode: "numeric" })}{F("ifsc", "IFSC")}</div>
      {st?.error && <p className="error small" role="alert">{st.error}</p>}
      <div><button className="sm" aria-busy={pending} disabled={pending}>Save</button></div>
    </form>
  );
}
