"use client";
import { useActionState, useState } from "react";
import { addMember } from "@/app/app/settings/team/actions";
import { ROLES } from "@/lib/roles";

export default function AddMemberForm({ tenantId }) {
  const [state, action, pending] = useActionState(addMember, {});
  const [role, setRole] = useState("manager");
  const [copied, setCopied] = useState(false);
  return (
    <form action={action} className="stack-sm">
      {tenantId && <input type="hidden" name="tenant_id" value={tenantId} />}
      <div className="form-grid">
        <div><label htmlFor="m_name">Name</label><input id="m_name" name="full_name" placeholder="Priya Bansal" /></div>
        <div><label htmlFor="m_email">Email</label><input id="m_email" name="email" type="email" required placeholder="priya@yourfirm.in" /></div>
        <div>
          <label htmlFor="m_role">Role</label>
          <select id="m_role" name="role" value={role} onChange={(e) => setRole(e.target.value)}>
            {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
          </select>
        </div>
      </div>
      <p className="tiny faint" style={{ margin: 0 }}>{ROLES[role].help}</p>
      {state?.error && <p className="error">{state.error}</p>}
      {state?.message && (
        <div className="notice small" style={{ display: "block" }}>
          <div>{state.message}</div>
          {state.link && (
            <div className="row" style={{ marginTop: 8, flexWrap: "nowrap" }}>
              <code style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{state.link}</code>
              <button type="button" className="sm ghost" onClick={() => { navigator.clipboard.writeText(state.link); setCopied(true); }}>{copied ? "Copied" : "Copy link"}</button>
              <a className="btn sm gold" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent("You have been added to Dhandha. Create your login here: " + state.link)}`}>WhatsApp</a>
            </div>
          )}
        </div>
      )}
      <div><button disabled={pending}>{pending ? "Adding…" : "Add person"}</button></div>
    </form>
  );
}
