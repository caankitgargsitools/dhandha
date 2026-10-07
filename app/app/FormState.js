"use client";
import { useActionState } from "react";

// Wraps a server action form and shows its error / success message.
export default function FormState({ action, children, submit = "Save", className = "stack" }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && <p className="error">{state.error}</p>}
      {state?.message && <p className="small" style={{ color: "var(--ok)" }}>{state.message}</p>}
      <div><button disabled={pending}>{pending ? "Saving…" : submit}</button></div>
    </form>
  );
}
