"use client";
import { useActionState } from "react";
import { createKey } from "./actions";

export default function KeyForm() {
  const [state, action, pending] = useActionState(createKey, {});
  return (
    <form action={action} className="stack-sm">
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <input name="name" placeholder="e.g. AWS Mumbai server" aria-label="Key name" style={{ maxWidth: 280 }} />
        <button aria-busy={!!pending} disabled={pending}>{pending ? "Creating…" : "Create key"}</button>
      </div>
      {state?.error && <p className="error">{state.error}</p>}
      {state?.key && (
        <div className="notice small" style={{ display: "block" }}>
          <strong>Copy this now — the key is shown only once.</strong>
          <ol style={{ margin: "8px 0", paddingLeft: 18 }}>
            <li>AWS console → EC2 in Asia Pacific (Mumbai) → Launch instance: image Ubuntu Server 24.04 LTS (64-bit Arm), instance type t4g (e.g. t4g.small).</li>
            <li>Advanced details → User data → paste everything below → Launch instance.</li>
            <li>In about 10 minutes the first run appears under Recent runs on this page.</li>
          </ol>
          <textarea readOnly rows={12} value={state.script} onFocus={(e) => e.target.select()} style={{ width: "100%", fontFamily: "monospace", fontSize: 12 }} aria-label="Server setup script" />
          <p className="tiny faint" style={{ margin: "6px 0 0" }}>Running it on your own server instead: save as setup.sh and run <code>sudo bash setup.sh</code>. Key alone: <code style={{ wordBreak: "break-all" }}>{state.key}</code></p>
        </div>
      )}
    </form>
  );
}
