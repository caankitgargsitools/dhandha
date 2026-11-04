"use client";
import { useActionState } from "react";
import { applyReset } from "./actions";

export default function ResetForm({ token }) {
  const [state, action, pending] = useActionState(applyReset, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="token" value={token} />
      <div><label htmlFor="password">New password</label><input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" /></div>
      <div><label htmlFor="again">Type it again</label><input id="again" name="again" type="password" required minLength={8} autoComplete="new-password" /></div>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <button aria-busy={!!pending} disabled={pending}>{pending ? "Saving…" : "Save new password"}</button>
    </form>
  );
}
