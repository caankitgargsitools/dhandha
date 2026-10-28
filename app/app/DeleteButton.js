"use client";
import { useActionState } from "react";
import { deleteRow } from "./actions";

// Delete one Vault row: asks first, spins while it runs and shows the database's answer if it fails.
export default function DeleteButton({ table, id }) {
  const [state, formAction, pending] = useActionState(deleteRow, {});
  return (
    <form action={formAction} onSubmit={(e) => { if (!window.confirm("Delete this? It cannot be undone.")) e.preventDefault(); }}>
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      <button className="danger" title="Delete" disabled={pending} aria-busy={pending}>Delete</button>
      {state?.error && <p className="error tiny" style={{ margin: "4px 0 0" }}>{state.error}</p>}
    </form>
  );
}
