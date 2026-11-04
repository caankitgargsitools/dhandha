"use client";
import { useActionState } from "react";
import { requestReset } from "./actions";

export default function ForgotForm() {
  const [state, action, pending] = useActionState(requestReset, {});
  if (state?.message) return <p className="notice small" role="status" style={{ margin: 0 }}>{state.message}</p>;
  return (
    <form action={action} className="stack">
      <div><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" /></div>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <button aria-busy={!!pending} disabled={pending}>{pending ? "Please wait…" : "Ask for a reset link"}</button>
    </form>
  );
}
