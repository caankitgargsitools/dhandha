"use client";
import { useActionState } from "react";

// A small form for a server action that returns { error } or { message }: shows the answer under the form.
// Put a <SubmitButton> inside for the busy state. `confirm` asks before submitting.
export default function ActionForm({ action, children, className, style, confirm }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className={className} style={style} onSubmit={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}>
      {children}
      {state?.error && <p className="error tiny" style={{ margin: "4px 0 0", flexBasis: "100%" }}>{state.error}</p>}
    </form>
  );
}
