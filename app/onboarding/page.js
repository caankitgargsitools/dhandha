import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingForm from "./OnboardingForm";

export default async function Onboarding() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: m } = await supabase.from("tenant_members").select("tenant_id").limit(1);
  if (m && m.length) redirect("/app");
  return (
    <div className="center">
      <div className="auth stack" style={{ maxWidth: 480 }}>
        <div className="logo">Dhan<span>dha</span></div>
        <div className="panel stack">
          <div>
            <h1>Set up your workspace</h1>
            <p className="muted small" style={{ margin: 0 }}>Your 7-day trial with 500 credits starts now.</p>
          </div>
          <OnboardingForm />
        </div>
      </div>
    </div>
  );
}
