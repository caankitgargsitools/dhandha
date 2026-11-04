import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import ForgotForm from "./ForgotForm";

export default function Forgot() {
  return (
    <AuthShell>
      <div>
        <h1>Forgot your password?</h1>
        <p className="muted">Type the e-mail you sign in with. We'll ask your workspace admin to send you a one-time link to set a new password.</p>
      </div>
      <div className="panel"><ForgotForm /></div>
      <p className="small muted"><Link href="/login">Back to sign in</Link></p>
    </AuthShell>
  );
}
