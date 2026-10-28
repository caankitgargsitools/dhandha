"use client";
import { useState, useTransition } from "react";
import { submitReferral } from "./actions";

export default function Form({ token, business }) {
  const [f, setF] = useState({ name: "", contact: "", phone: "", email: "", city: "", note: "" });
  const [done, setDone] = useState(false);
  const [err, setErr] = useState(null);
  const [pending, start] = useTransition();
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const send = () => start(async () => { setErr(null); const r = await submitReferral(token, f); r.error ? setErr(r.error) : setDone(true); });
  if (done) return <div className="notice info" style={{ display: "block" }}><strong>Thank you!</strong> {business} will get in touch with them soon.</div>;
  return (
    <div className="stack-sm">
      <div className="grid-2">
        <label>Business or person&apos;s name<input value={f.name} onChange={set("name")} maxLength={200} /></label>
        <label>Contact person<input value={f.contact} onChange={set("contact")} maxLength={120} /></label>
        <label>Mobile<input value={f.phone} onChange={set("phone")} maxLength={20} inputMode="tel" /></label>
        <label>Email (optional)<input value={f.email} onChange={set("email")} maxLength={200} type="email" /></label>
        <label>City<input value={f.city} onChange={set("city")} maxLength={80} /></label>
        <label>What do they need? (optional)<input value={f.note} onChange={set("note")} maxLength={500} /></label>
      </div>
      <div><button type="button" onClick={send} disabled={pending || f.name.trim().length < 2} aria-busy={pending}>Send the referral</button></div>
      {err && <p className="error" style={{ margin: 0 }}>{err}</p>}
      <p className="tiny faint" style={{ margin: 0 }}>Please refer only people who are happy to be contacted.</p>
    </div>
  );
}
