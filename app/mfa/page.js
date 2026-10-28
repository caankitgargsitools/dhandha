import AuthShell from "@/components/AuthShell";
import MfaChallenge from "./MfaChallenge";
import { signOut } from "../login/actions";

// only a path on this site, never another address
const safeNext = (v) => (/^\/(app|admin)(\/[\w\-/]*)?$/.test(String(v || "")) ? String(v) : "/app");

export default async function MfaPage({ searchParams }) {
  const next = safeNext((await searchParams)?.next);
  return (
    <AuthShell title="One more check." lines="Two-factor login keeps your signature and documents safe.">
      <div>
        <h1>Enter your 6-digit code</h1>
        <p className="muted">Open your authenticator app (Google Authenticator, Microsoft Authenticator, Authy…) and type the current code shown for Dhandha. The code changes every 30 seconds.</p>
      </div>
      <div className="panel"><MfaChallenge next={next} /></div>
      <p className="small muted" style={{ margin: 0 }}>
        Lost your phone or the authenticator app? Sign out below and contact Dhandha support to reset two-factor login for your account.
      </p>
      <form action={signOut}><button className="ghost sm">Sign out</button></form>
    </AuthShell>
  );
}
