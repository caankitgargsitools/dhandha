"use client";
import { useActionState } from "react";
import { addFirstCompany } from "./actions";

export default function FirstCompanyForm({ tenantId }) {
  const [state, action, pending] = useActionState(addFirstCompany, {});
  return (
    <form action={action} className="stack">
      <input type="hidden" name="tenant" value={tenantId} />
      <div><label htmlFor="company">Company name</label><input id="company" name="company" required maxLength={200} /></div>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <button aria-busy={pending} disabled={pending}>Add company</button>
    </form>
  );
}
