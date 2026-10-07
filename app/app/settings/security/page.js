import { getContext } from "@/lib/session";
import TwoFactor from "./TwoFactor";

export default async function Security() {
  const { has2fa, isAdmin } = await getContext();
  return (
    <div className="stack">
      <h1>Security</h1>
      <div className="panel stack">
        <h3>Two-factor login</h3>
        <p className="muted small" style={{ margin: 0 }}>
          After your password, Dhandha asks for a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy).
          {isAdmin && " Required for admins, and needed before a signature or seal can be stored."}
        </p>
        <TwoFactor enabled={has2fa} />
      </div>
    </div>
  );
}
