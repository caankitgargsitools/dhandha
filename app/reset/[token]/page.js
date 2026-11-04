import Link from "next/link";
import AuthShell from "@/components/AuthShell";
import { createClient } from "@/lib/supabase/server";
import ResetForm from "./ResetForm";

export const metadata = { robots: { index: false } };

export default async function Reset({ params }) {
  const { token } = await params;
  const ok = /^[0-9a-f-]{36}$/i.test(token);
  const supabase = await createClient();
  const { data: email } = ok ? await supabase.rpc("password_reset_check", { p_token: token }) : { data: null };
  return (
    <AuthShell>
      <div>
        <h1>Set a new password</h1>
        <p className="muted">{email ? `For ${email}.` : "This link has expired or was already used."}</p>
      </div>
      {email ? <div className="panel"><ResetForm token={token} /></div>
        : <p className="small"><Link href="/login/forgot">Ask for a new link</Link> · <Link href="/login">Sign in</Link></p>}
    </AuthShell>
  );
}
