"use client";
import { useState, useTransition } from "react";
import { respondQuote } from "./actions";

export default function Respond({ token }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(null);
  const [err, setErr] = useState(null);
  const [pending, start] = useTransition();
  const go = (accept) => start(async () => { setErr(null); const r = await respondQuote(token, accept, name, note); r.error ? setErr(r.error) : setDone(r.status); });
  if (done) return <div className="notice info" style={{ display: "block" }}><strong>Thank you — the quotation is {done}.</strong> The team has been told.</div>;
  return (
    <div className="stack-sm no-print">
      <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></label>
      <label>Note (optional)<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="e.g. Please start from next month" /></label>
      <div className="row" style={{ gap: 10 }}>
        <button type="button" onClick={() => go(true)} disabled={pending || name.trim().length < 2} aria-busy={pending}>Accept quotation</button>
        <button type="button" className="ghost" onClick={() => go(false)} disabled={pending || name.trim().length < 2}>Decline</button>
        <button type="button" className="ghost" onClick={() => window.print()}>Print / save as PDF</button>
      </div>
      {err && <p className="error" style={{ margin: 0 }}>{err}</p>}
    </div>
  );
}
