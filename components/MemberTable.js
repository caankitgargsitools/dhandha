import { ROLES } from "@/lib/roles";
import { changeRole, disableMember, revokeInvite } from "@/app/app/settings/team/actions";
import { fmtDate } from "@/lib/session";
import InviteShare from "./InviteShare";
import ActionForm from "./ActionForm";
import SubmitButton from "./SubmitButton";

// People and pending invites of one workspace; editable when canManage.
export default function MemberTable({ members, invites, canManage, tenantId, selfId, origin }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Person</th><th>Role</th><th>Since</th>{canManage && <th></th>}</tr></thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.user_id} style={m.role === "disabled" ? { opacity: 0.5 } : undefined}>
              <td><strong>{m.profiles?.full_name || "—"}</strong><div className="tiny faint">{m.profiles?.email}</div></td>
              <td>
                {canManage && m.role !== "disabled" && m.user_id !== selfId ? (
                  <ActionForm action={changeRole} className="row" style={{ gap: 6 }}>
                    <input type="hidden" name="tenant_id" value={tenantId} /><input type="hidden" name="user_id" value={m.user_id} />
                    <select name="role" defaultValue={m.role} style={{ width: "auto", padding: "5px 8px" }} aria-label="Role">
                      {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
                    </select>
                    <SubmitButton className="ghost sm">Save</SubmitButton>
                  </ActionForm>
                ) : <span className={`chip ${m.role === "disabled" ? "mute" : "info"} plain`}>{m.role === "disabled" ? "Removed" : ROLES[m.role]?.label}</span>}
              </td>
              <td className="small faint">{fmtDate(m.created_at)}</td>
              {canManage && (
                <td>{m.role !== "disabled" && m.user_id !== selfId && (
                  <ActionForm action={disableMember} confirm="Remove this person from the workspace?"><input type="hidden" name="tenant_id" value={tenantId} /><input type="hidden" name="user_id" value={m.user_id} /><SubmitButton className="danger">Remove</SubmitButton></ActionForm>
                )}</td>
              )}
            </tr>
          ))}
          {invites.map((i) => (
            <tr key={i.id}>
              <td><strong>{i.full_name || i.email}</strong><div className="tiny faint">{i.email} · not signed up yet — they sign up with this email, or use the link</div>{canManage && origin && i.token && <div style={{ marginTop: 4 }}><InviteShare url={`${origin}/login?invite=${i.token}`} name={i.full_name} /></div>}</td>
              <td><span className="chip warn">Invited · {ROLES[i.role]?.label}</span></td>
              <td className="small faint">{fmtDate(i.created_at)}</td>
              {canManage && <td><ActionForm action={revokeInvite} confirm="Cancel this invite?"><input type="hidden" name="tenant_id" value={tenantId} /><input type="hidden" name="invite_id" value={i.id} /><SubmitButton className="danger">Cancel invite</SubmitButton></ActionForm></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
