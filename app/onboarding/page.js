import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthShell from "@/components/AuthShell";
import OnboardingForm from "./OnboardingForm";
import FirstCompanyForm from "./FirstCompanyForm";

export default async function Onboarding() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await supabase.rpc("claim_invites");
  const { data: m } = await supabase.from("tenant_members").select("tenant_id, role, tenants(name)").eq("user_id", user.id).neq("role", "disabled").limit(1);
  if (m && m.length) {
    // a member of a workspace with no company left (all removed): add one instead of looping back to /app
    const { count } = await supabase.from("companies").select("id", { count: "exact", head: true }).eq("tenant_id", m[0].tenant_id);
    if (count) redirect("/app");
    return (
      <AuthShell title="Add your company." lines="Your workspace has no company yet.">
        <div>
          <h1>Add a company to {m[0].tenants?.name || "your workspace"}</h1>
          <p className="muted">{m[0].role === "admin" ? "Tenders, the Vault and leads all belong to a company." : "Ask your workspace admin to add a company, then open Dhandha again."}</p>
        </div>
        {m[0].role === "admin" && <div className="panel"><FirstCompanyForm tenantId={m[0].tenant_id} /></div>}
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Set up your khata." lines="Tell us whose business this is. Your 7-day trial with 500 credits starts now.">
      <div>
        <h1>Set up your workspace</h1>
        <p className="muted">You can add more companies later.</p>
      </div>
      <div className="panel"><OnboardingForm /></div>
    </AuthShell>
  );
}
