import Link from "next/link";
import { getContext, daysLeft, initials, ROLES } from "@/lib/session";
import SideNav from "@/components/SideNav";
import Icon from "@/components/Icon";
import { switchCompany } from "./actions";
import { signOut } from "../login/actions";

export default async function AppLayout({ children }) {
  const { tenant, companies, company, user, role, isAdmin, has2fa, isPlatformAdmin, otherWorkspaces } = await getContext();
  const trialLeft = daysLeft(tenant.trial_ends_at);
  const sections = [
    { items: [{ href: "/app", label: "Dashboard", icon: "home" }, { href: "/app/tasks", label: "Tasks", icon: "check" }] },
    { title: "Find business", items: [
      { href: "/app/tenders", label: "Tenders", icon: "tender" },
      { href: "/app/leads", label: "Leads", icon: "leads" },
      { href: "/app/crm", label: "CRM pipeline", icon: "crm" },
    ] },
    { title: "Business Vault", items: [
      { href: "/app/tenders/preferences", label: "What we do", icon: "briefcase" },
      { href: "/app/vault/profile", label: "Company profile", icon: "building" },
      { href: "/app/vault/documents", label: "Documents", icon: "doc" },
      { href: "/app/vault/facts", label: "Facts", icon: "facts" },
      { href: "/app/vault/experience", label: "Experience", icon: "briefcase" },
      { href: "/app/vault/people", label: "Key people", icon: "people" },
      { href: "/app/brand", label: "Letterhead & signature", icon: "pen" },
    ] },
    { title: "Account", items: [
      { href: "/app/wallet", label: "Credits & plan", icon: "wallet" },
      { href: "/app/support", label: "Help & tickets", icon: "ticket" },
      { href: "/app/settings/team", label: "Team", icon: "people" },
      { href: "/app/settings/security", label: "Security", icon: "shield" },
      ...(tenant.kind === "firm" || companies.length > 1 ? [{ href: "/app/settings/companies", label: "Companies", icon: "building" }] : []),
      ...(isAdmin ? [{ href: "/app/settings/audit", label: "Audit log", icon: "log" }] : []),
      ...(isPlatformAdmin ? [{ href: "/admin", label: "Admin panel", icon: "admin" }] : []),
    ] },
  ];
  return (
    <div className="shell">
      <SideNav sections={sections} foot={<>{tenant.name}<br />Data stored in India</>} />
      <div className="main">
        <header className="topbar">
          <div className="co-switch">
            <div className="co-avatar" aria-hidden="true">{initials(company.legal_name)}</div>
            <div>
              {companies.length > 1 || otherWorkspaces.length ? (
                <form action={switchCompany} className="row" style={{ gap: 8 }}>
                  <select name="company_id" defaultValue={company.id} aria-label="Company" style={{ width: "auto", minWidth: 220, padding: "6px 10px", fontWeight: 700 }}>
                    <optgroup label={tenant.name}>{companies.map((c) => <option key={c.id} value={c.id}>{c.legal_name}</option>)}</optgroup>
                    {otherWorkspaces.length > 0 && (
                      <optgroup label="Other workspaces">{otherWorkspaces.filter((w) => w.firstCompany).map((w) => <option key={w.id} value={w.firstCompany}>{w.name}</option>)}</optgroup>
                    )}
                  </select>
                  <button className="ghost sm">Switch</button>
                </form>
              ) : (
                <strong style={{ fontFamily: "var(--display)", fontSize: 18 }}>{company.legal_name}</strong>
              )}
              <div className="faint tiny">{tenant.kind === "firm" ? "Firm workspace" : "Business workspace"} · your role: {ROLES[role]?.label || role}</div>
            </div>
          </div>
          <div className="row">
            {trialLeft !== null && trialLeft >= 0 && <span className="chip warn">Trial · {trialLeft} day{trialLeft === 1 ? "" : "s"} left</span>}
            <div className="user-pill">
              <span className="small muted">{user.email}</span>
              <form action={signOut}><button className="ghost sm" title="Sign out" aria-label="Sign out" style={{ borderRadius: 99, padding: 6 }}><Icon name="logout" size={16} /></button></form>
            </div>
          </div>
        </header>
        {isAdmin && !has2fa && (
          <div className="notice bad small" style={{ marginBottom: 22 }}>
            <Icon name="shield" />
            <span>Two-factor login is required for admins and must be on before a signature or seal can be stored. <Link href="/app/settings/security">Turn it on now</Link></span>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
