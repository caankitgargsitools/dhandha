"use client";
import { useActionState, useState } from "react";
import { createWorkspace } from "./actions";

export default function OnboardingForm() {
  const [state, action, pending] = useActionState(createWorkspace, {});
  const [kind, setKind] = useState("business");
  return (
    <form action={action} className="stack">
      <div>
        <label htmlFor="kind">Who is this for?</label>
        <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="business">My own business</option>
          <option value="firm">A CA / consultant firm managing several client companies</option>
        </select>
      </div>
      {kind === "firm" && (
        <div><label htmlFor="firm_name">Firm name</label><input id="firm_name" name="firm_name" required /></div>
      )}
      <div>
        <label htmlFor="company">{kind === "firm" ? "First company to manage (can be your own firm)" : "Company legal name"}</label>
        <input id="company" name="company" required />
      </div>
      {state?.error && <p className="error">{state.error}</p>}
      <button disabled={pending}>{pending ? "Creating…" : "Create workspace"}</button>
    </form>
  );
}
