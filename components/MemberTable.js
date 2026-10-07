import { ROLES } from "@/lib/roles";
import { changeRole, disableMember, revokeInvite } from "@/app/app/settings/team/actions";
import { fmtDate } from "@/lib/session";

// People and pending invites of one workspace; editable when canManage.
export default function MemberTable({ members, invites, canManage, tenantId, selfId }) {
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
                  <form action={changeRole} className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                    <input type="hidden" name="tenant_id" value={tenantId} /><input type="hidden" name="user_id" value={m.user_id} />
                    <select name="role" defaultValue={m.role} style={{ width: "auto", padding: "5px 8px" }} aria-label="Role">
                      {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
                    </select>
                    <button className="ghost sm">Save</button>
                  </form>
                ) : <span className={`chip ${m.role === "disabled" ? "mute" : "info"} plain`}>{m.role === "disabled" ? "Removed" : ROLES[m.role]?.label}</span>}
              </td>
              <td className="small faint">{fmtDate(m.created_at)}</td>
              {canManage && (
                <td>{m.role !== "disabled" && m.user_id !== selfId && (
                  <form action={disableMember}><input type="hidden" name="tenant_id" value={tenantId} /><input type="hidden" name="user_id" value={m.user_id} /><button className="danger">Remove</button></form>
                )}</td>
              )}
            </tr>
          ))}
          {invites.map((i) => (
            <tr key={i.id}>
              <td><strong>{i.full_name || i.email}</strong><div className="tiny faint">{i.email}</div></td>
              <td><span className="chip warn">Invited · {ROLES[i.role]?.label}</span></td>
              <td className="small faint">{fmtDate(i.created_at)}</td>
              {canManage && <td><form action={revokeInvite}><input type="hidden" name="tenant_id" value={tenantId} /><input type="hidden" name="invite_id" value={i.id} /><button className="danger">Cancel invite</button></form></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
