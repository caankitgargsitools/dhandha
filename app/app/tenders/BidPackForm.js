"use client";
import { useActionState } from "react";
import { generateBidPack } from "./bidActions";

export default function BidPackForm({ matchId, kind, disabled, note }) {
  const [state, action, pending] = useActionState(generateBidPack, {});
  return (
    <form action={action} className="stack-sm">
      <input type="hidden" name="match_id" value={matchId} />
      <input type="hidden" name="kind" value={kind} />
      {kind === "final" && (
        <div style={{ maxWidth: 220 }}>
          <label htmlFor="code">Authenticator code</label>
          <input id="code" name="code" inputMode="numeric" maxLength={6} placeholder="123456" autoComplete="one-time-code" disabled={disabled} required style={{ letterSpacing: 4, fontSize: 18 }} />
        </div>
      )}
      {note && <p className="tiny faint" style={{ margin: 0 }}>{note}</p>}
      {state?.error && <p className="error">{state.error}</p>}
      {state?.message && <p className="success">{state.message} {state.url && <a href={state.url} target="_blank" rel="noreferrer">Download PDF</a>}</p>}
      <div><button className={kind === "final" ? "" : "ghost"} disabled={pending || disabled}>{pending ? "Preparing…" : kind === "final" ? "Sign and generate bid pack" : "Preview draft (free)"}</button></div>
    </form>
  );
}
