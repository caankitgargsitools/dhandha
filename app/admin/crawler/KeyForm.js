"use client";
import { useActionState } from "react";
import { createKey } from "./actions";

export default function KeyForm() {
  const [state, action, pending] = useActionState(createKey, {});
  return (
    <form action={action} className="stack-sm">
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <input name="name" placeholder="e.g. Bangalore server" aria-label="Key name" style={{ maxWidth: 280 }} />
        <button disabled={pending}>{pending ? "Creating…" : "Create key"}</button>
      </div>
      {state?.error && <p className="error">{state.error}</p>}
      {state?.key && (
        <div className="notice small" style={{ display: "block" }}>
          <strong>Copy this key now — it is shown only once.</strong> Put it in the crawler's <code>.env</code> as <code>INGEST_KEY</code>.
          <div style={{ marginTop: 8 }}><code style={{ wordBreak: "break-all" }}>{state.key}</code></div>
        </div>
      )}
    </form>
  );
}
