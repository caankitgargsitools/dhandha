"use client";
import { useActionState } from "react";
import { uploadStatement } from "./actions";

export default function UploadForm() {
  const [st, act, pending] = useActionState(uploadStatement, {});
  return (
    <form action={act} className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div><label htmlFor="bf">Bank statement (CSV or Excel)</label><input id="bf" name="file" type="file" accept=".csv,.txt,.xlsx" required /></div>
      <div><label htmlFor="ba">Account</label><input id="ba" name="account" placeholder="Main account" /></div>
      <button className="sm" aria-busy={pending} disabled={pending}>Upload and match</button>
      {st?.error && <span className="error small">{st.error}</span>}
      {st?.message && <span className="success small">{st.message}</span>}
    </form>
  );
}
