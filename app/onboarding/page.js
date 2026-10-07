import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AuthShell from "@/components/AuthShell";
import OnboardingForm from "./OnboardingForm";

export default async function Onboarding() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: m } = await supabase.from("tenant_members").select("tenant_id").limit(1);
  if (m && m.length) redirect("/app");
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
