import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import AuthForm from "./AuthForm";

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const mode = params?.mode === "signup" ? "signup" : "signin";
  return (
    <AuthShell>
      <div>
        <h1>{mode === "signup" ? "Start your 7-day trial" : "Sign in to Dhandha"}</h1>
        <p className="muted">{mode === "signup" ? "500 free credits. No card needed." : "Welcome back."}</p>
      </div>
      <div className="panel"><AuthForm mode={mode} /></div>
      {params?.error && <p className="error">{params.error}</p>}
      <p className="small muted">
        {mode === "signup" ? <>Already have an account? <Link href="/login">Sign in</Link></> : <>New to Dhandha? <Link href="/login?mode=signup">Create an account</Link></>}
      </p>
    </AuthShell>
  );
}
