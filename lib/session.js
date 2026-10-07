import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "./supabase/server";

export const COMPANY_COOKIE = "dh_company";

// Loads the signed-in user, their workspace, the selected company and role.
// Redirects to login / 2FA / onboarding as needed.
export async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") redirect("/mfa");

  const { data: memberships } = await supabase
    .from("tenant_members")
    .select("tenant_id, role, tenants(id, name, kind, trial_ends_at)")
    .eq("user_id", user.id);
  if (!memberships || memberships.length === 0) redirect("/onboarding");

  const membership = memberships[0];
  const tenant = membership.tenants;
  const { data: companies } = await supabase
    .from("companies")
    .select("id, legal_name")
    .eq("tenant_id", tenant.id)
    .order("created_at");

  const store = await cookies();
  const wanted = store.get(COMPANY_COOKIE)?.value;
  const company = companies.find((c) => c.id === wanted) || companies[0];

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const has2fa = (factors?.totp || []).some((f) => f.status === "verified");

  return {
    supabase,
    user,
    tenant,
    role: membership.role,
    isAdmin: membership.role === "admin",
    companies,
    company,
    has2fa,
  };
}

export function daysLeft(date) {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

export const inr = (n) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(n || 0));
