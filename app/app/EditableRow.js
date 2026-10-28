"use client";
import { useActionState, useEffect, useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import DeleteButton from "./DeleteButton";

// A Vault table row with an "Edit" button: opens the row's fields (`form`, rendered by the page with the row's
// current values) in a full-width row underneath and saves through `action` (gets the row id as `id`).
// The delete button stays for those who may delete.
export default function EditableRow({ id, action, form, colSpan, canEdit, deleteTable, canDelete, children }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, {});
  useEffect(() => { if (state?.message) setOpen(false); }, [state]);
  return (
    <>
      <tr>
        {children}
        <td>
          <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
            {canEdit && (
              <button type="button" className="ghost sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                {open ? "Close" : "Edit"}
              </button>
            )}
            {canDelete && <DeleteButton table={deleteTable} id={id} />}
          </div>
          {!open && state?.message && <p className="tiny" style={{ margin: "4px 0 0", color: "var(--ok)" }}>{state.message}</p>}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={colSpan}>
            <form action={formAction} className="stack">
              <input type="hidden" name="id" value={id} />
              {form}
              {state?.error && <p className="error">{state.error}</p>}
              <div className="row">
                <SubmitButton>Save changes</SubmitButton>
                <button type="button" className="ghost" onClick={() => setOpen(false)}>Cancel</button>
              </div>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}
