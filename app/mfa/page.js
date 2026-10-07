import AuthShell from "@/components/AuthShell";
import MfaChallenge from "./MfaChallenge";

export default function MfaPage() {
  return (
    <AuthShell title="One more check." lines="Two-factor login keeps your signature and documents safe.">
      <div>
        <h1>Enter your 6-digit code</h1>
        <p className="muted">Open your authenticator app and type the current code for Dhandha.</p>
      </div>
      <div className="panel"><MfaChallenge /></div>
    </AuthShell>
  );
}
