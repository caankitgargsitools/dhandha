import AuthShell from "@/components/AuthShell";
import MfaChallenge from "./MfaChallenge";
import { signOut } from "../login/actions";

import { safeNext } from "@/lib/safeNext";

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
        Lost your phone or the authenticator app? Sign out below and ask Dhandha support (or your workspace admin, who can raise it with us) to reset two-factor login. We check it is really you by calling your registered number, then you set up a new authenticator.
      </p>
      <form action={signOut}><button className="ghost sm">Sign out</button></form>
    </AuthShell>
  );
}
