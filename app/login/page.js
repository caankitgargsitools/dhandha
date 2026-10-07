import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import AuthForm from "./AuthForm";
import { createClient } from "@/lib/supabase/server";
import { ROLES } from "@/lib/session";

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  let mode = params?.mode === "signup" ? "signup" : "signin";
  let invite = null;
  if (params?.invite && /^[0-9a-f-]{36}$/i.test(params.invite)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("invite_info", { p_token: params.invite });
    invite = data;
    if (invite) mode = "signup";
  }
  return (
    <AuthShell>
      <div>
        <h1>{invite ? `Join ${invite.workspace}` : mode === "signup" ? "Start your 7-day trial" : "Sign in to Dhandha"}</h1>
        <p className="muted">{invite ? `You have been added as ${ROLES[invite.role]?.label || invite.role}. Create your login with this email; if you already have one, just sign in.` : mode === "signup" ? "500 free credits. No card needed." : "Welcome back."}</p>
      </div>
      <div className="panel"><AuthForm mode={mode} email={invite?.email} name={invite?.full_name} /></div>
      {params?.error && <p className="error">{params.error}</p>}
      <p className="small muted">
        {mode === "signup" ? <>Already have an account? <Link href="/login">Sign in</Link></> : <>New to Dhandha? <Link href="/login?mode=signup">Create an account</Link></>}
      </p>
    </AuthShell>
  );
}
