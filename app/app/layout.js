import Link from "next/link";
import { getContext, daysLeft } from "@/lib/session";
import { switchCompany } from "./actions";
import { signOut } from "../login/actions";

export default async function AppLayout({ children }) {
  const { tenant, companies, company, user, role, isAdmin, has2fa } = await getContext();
  const trialLeft = daysLeft(tenant.trial_ends_at);
  return (
    <div className="shell">
      <nav className="side">
        <Link href="/app" className="logo" style={{ padding: "4px 10px 10px" }}>Dhan<span>dha</span></Link>
        <Link href="/app">Dashboard</Link>
        <div className="group">Business Vault</div>
        <Link href="/app/vault/profile">Company profile</Link>
        <Link href="/app/vault/documents">Documents</Link>
        <Link href="/app/vault/facts">Facts</Link>
        <Link href="/app/vault/experience">Experience</Link>
        <Link href="/app/vault/people">Key people</Link>
        <Link href="/app/brand">Letterhead & signature</Link>
        <div className="group">Coming next</div>
        <span className="muted small" style={{ padding: "4px 10px" }}>Tenders · Leads · CRM · Content</span>
        <div className="group">Account</div>
        <Link href="/app/wallet">Credits & plan</Link>
        <Link href="/app/settings/security">Security</Link>
        {tenant.kind === "firm" || companies.length > 1 ? <Link href="/app/settings/companies">Companies</Link> : null}
        {isAdmin && <Link href="/app/settings/audit">Audit log</Link>}
      </nav>
      <div className="main">
        <div className="topbar">
          <div>
            {companies.length > 1 ? (
              <form action={switchCompany} className="row">
                <select name="company_id" defaultValue={company.id} style={{ width: "auto", minWidth: 220 }}>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.legal_name}</option>)}
                </select>
                <button className="ghost">Switch</button>
              </form>
            ) : (
              <strong>{company.legal_name}</strong>
            )}
            <div className="muted small">{tenant.name} · {role}</div>
          </div>
          <div className="row">
            {trialLeft !== null && trialLeft >= 0 && <span className="chip info">Trial: {trialLeft} day{trialLeft === 1 ? "" : "s"} left</span>}
            <span className="muted small">{user.email}</span>
            <form action={signOut}><button className="ghost">Sign out</button></form>
          </div>
        </div>
        {isAdmin && !has2fa && (
          <p className="notice bad small" style={{ marginBottom: 20 }}>
            Two-factor login is required for admins and must be on before a signature or seal can be stored.{" "}
            <Link href="/app/settings/security">Turn it on now</Link>
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
