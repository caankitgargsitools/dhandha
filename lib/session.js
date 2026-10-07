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

  const loadMemberships = () =>
    supabase.from("tenant_members").select("tenant_id, role, tenants(id, name, kind, trial_ends_at)").eq("user_id", user.id).neq("role", "disabled");
  let { data: memberships } = await loadMemberships();
  if (!memberships || memberships.length === 0) {
    const { data: claimed } = await supabase.rpc("claim_invites");
    if (claimed > 0) ({ data: memberships } = await loadMemberships());
  }
  if (!memberships || memberships.length === 0) redirect("/onboarding");

  // A person can belong to several workspaces (e.g. a consultant); companies from all of them are listed.
  const { data: allCompanies } = await supabase
    .from("companies")
    .select("id, legal_name, tenant_id")
    .in("tenant_id", memberships.map((m) => m.tenant_id))
    .order("created_at");
  const store = await cookies();
  const wanted = store.get(COMPANY_COOKIE)?.value;
  const company = allCompanies.find((c) => c.id === wanted) || allCompanies[0];
  const membership = memberships.find((m) => m.tenant_id === company.tenant_id);
  const tenant = membership.tenants;
  const companies = allCompanies.filter((c) => c.tenant_id === tenant.id);
  const otherWorkspaces = memberships.filter((m) => m.tenant_id !== tenant.id).map((m) => ({
    ...m.tenants, firstCompany: allCompanies.find((c) => c.tenant_id === m.tenant_id)?.id,
  }));

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const has2fa = (factors?.totp || []).some((f) => f.status === "verified");
  const { data: pa } = await supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();

  return {
    supabase,
    user,
    tenant,
    role: membership.role,
    isAdmin: membership.role === "admin",
    companies,
    company,
    otherWorkspaces,
    has2fa,
    isPlatformAdmin: !!pa,
  };
}

export function daysLeft(date) {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

export const inr = (n) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number(n || 0));

export const lakh = (n) => {
  const v = Number(n || 0);
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2).replace(/\.?0+$/, "")} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2).replace(/\.?0+$/, "")} L`;
  return `₹${new Intl.NumberFormat("en-IN").format(v)}`;
};

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
export const initials = (s) => (s || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export { ROLES } from "./roles";

// Whole calendar days (India time) from today to the date: 0 = today, -1 = yesterday.
export function calDays(date) {
  if (!date) return null;
  const ist = (d) => { const x = new Date(new Date(d).getTime() + 330 * 60000); return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()); };
  return Math.round((ist(date) - ist(Date.now())) / 864e5);
}
