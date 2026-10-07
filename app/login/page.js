import Link from "next/link";
import AuthForm from "./AuthForm";

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const mode = params?.mode === "signup" ? "signup" : "signin";
  return (
    <div className="center">
      <div className="auth stack">
        <Link href="/" className="logo">Dhan<span>dha</span></Link>
        <div className="panel stack">
          <div>
            <h1>{mode === "signup" ? "Start your 7-day trial" : "Sign in"}</h1>
            <p className="muted small" style={{ margin: 0 }}>
              {mode === "signup" ? "500 free credits. No card needed." : "Welcome back."}
            </p>
          </div>
          <AuthForm mode={mode} />
          {params?.error && <p className="error">{params.error}</p>}
        </div>
        <p className="small muted" style={{ textAlign: "center" }}>
          {mode === "signup" ? (
            <>Already have an account? <Link href="/login">Sign in</Link></>
          ) : (
            <>New to Dhandha? <Link href="/login?mode=signup">Create an account</Link></>
          )}
        </p>
      </div>
    </div>
  );
}
