"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getContext, ROLES } from "@/lib/session";

async function origin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") || "https"}://${h.get("x-forwarded-host") || h.get("host")}`;
}

// Used by both the workspace Team page and the platform admin panel (the database checks who may do it).
export async function addMember(prev, formData) {
  const { supabase, tenant } = await getContext();
  const tenantId = String(formData.get("tenant_id") || tenant.id);
  const email = String(formData.get("email") || "").trim();
  const role = String(formData.get("role"));
  if (!ROLES[role]) return { error: "Choose a role." };
  const { data, error } = await supabase.rpc("add_team_member", { p_tenant: tenantId, p_email: email, p_role: role, p_name: String(formData.get("full_name") || "") });
  if (error) return { error: error.message };
  revalidatePath("/app/settings/team");
  revalidatePath(`/admin/tenants/${tenantId}`);
  if (data.status === "added") return { message: `${email} already had a Dhandha login and has been added as ${ROLES[role].label}.` };
  return { message: `Invite ready. Send this link to ${email}:`, link: `${await origin()}/login?invite=${data.token}` };
}

export async function changeRole(formData) {
  const { supabase, tenant } = await getContext();
  const tenantId = String(formData.get("tenant_id") || tenant.id);
  await supabase.rpc("set_member_role", { p_tenant: tenantId, p_user: String(formData.get("user_id")), p_role: String(formData.get("role")) });
  revalidatePath("/app/settings/team");
  revalidatePath(`/admin/tenants/${tenantId}`);
}

export async function disableMember(formData) {
  const { supabase, tenant } = await getContext();
  const tenantId = String(formData.get("tenant_id") || tenant.id);
  await supabase.rpc("disable_member", { p_tenant: tenantId, p_user: String(formData.get("user_id")) });
  revalidatePath("/app/settings/team");
  revalidatePath(`/admin/tenants/${tenantId}`);
}

export async function revokeInvite(formData) {
  const { supabase, tenant } = await getContext();
  await supabase.rpc("revoke_invite", { p_invite: String(formData.get("invite_id")) });
  revalidatePath("/app/settings/team");
  revalidatePath(`/admin/tenants/${String(formData.get("tenant_id") || tenant.id)}`);
}
