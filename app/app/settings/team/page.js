import { getContext } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import MemberTable from "@/components/MemberTable";
import AddMemberForm from "@/components/AddMemberForm";

export default async function Team() {
  const { supabase, tenant, isAdmin, user } = await getContext();
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from("tenant_members").select("user_id, role, created_at, profiles(full_name, email)").eq("tenant_id", tenant.id).order("created_at"),
    isAdmin ? supabase.from("invites").select("*").eq("tenant_id", tenant.id).is("accepted_at", null).is("revoked_at", null) : Promise.resolve({ data: [] }),
  ]);
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Team</h1><p>People in {tenant.name} and what each role can do. Assign them work from Tasks.</p></div></div>
      {isAdmin && (
        <div className="panel">
          <h3>Add a person</h3>
          <AddMemberForm />
        </div>
      )}
      <div className="panel flush"><MemberTable members={members || []} invites={invites || []} canManage={isAdmin} tenantId={tenant.id} selfId={user.id} /></div>
      <div className="panel">
        <h3>Roles</h3>
        <div className="grid">{Object.entries(ROLES).map(([k, r]) => <div key={k}><strong>{r.label}</strong><p className="small muted" style={{ margin: 0 }}>{r.help}</p></div>)}</div>
      </div>
    </div>
  );
}
