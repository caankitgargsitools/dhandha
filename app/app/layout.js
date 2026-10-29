import Link from "next/link";
import { getContext, daysLeft, initials, ROLES } from "@/lib/session";
import SideNav, { MenuButton } from "@/components/SideNav";
import Icon from "@/components/Icon";
import { switchCompany } from "./actions";
import { signOut } from "../login/actions";
import CaptchaDesk from "../admin/CaptchaDesk";

export default async function AppLayout({ children }) {
  const { supabase, tenant, companies, company, user, role, isAdmin, has2fa, isPlatformAdmin, otherWorkspaces } = await getContext();
  // credit balance on every page (amber when low, red at zero) — 1 credit = ₹1
  const { data: wallet } = await supabase.from("wallets").select("balance").eq("tenant_id", tenant.id).maybeSingle();
  const balance = Number(wallet?.balance || 0);
  const trialLeft = daysLeft(tenant.trial_ends_at);
  const sections = [
    { items: [{ href: "/app", label: "Dashboard", icon: "home" }, { href: "/app/tasks", label: "Tasks", icon: "check" }] },
    { items: [{ href: "/app/source", label: "Source new business", icon: "leads", match: ["/app/source", "/app/tenders", "/app/leads", "/app/settings/facebook"], exclude: ["/app/tenders/preferences", "/app/leads/playbook"], children: [
      { href: "/app/tenders", label: "Tenders", icon: "tender", exclude: ["/app/tenders/preferences"] },
      { href: "/app/leads/generate", label: "Generate leads", icon: "leads", match: ["/app/leads", "/app/settings/facebook"], exclude: ["/app/leads/playbook"] },
    ] }] },
    { title: "Win the business", items: [
      { href: "/app/inbox", label: "WhatsApp inbox", icon: "mail" },
      { href: "/app/leads/playbook", label: "Lead Playbook", icon: "check" },
      { href: "/app/crm", label: "CRM pipeline", icon: "crm", exclude: ["/app/crm/quotes", "/app/crm/targets", "/app/crm/invoices", "/app/crm/catalog"] },
      { href: "/app/crm/targets", label: "Targets & leaderboard", icon: "rupee" },
      { href: "/app/crm/quotes", label: "Quotations", icon: "doc" },
      { href: "/app/crm/invoices", label: "Invoices", icon: "rupee" },
      { href: "/app/crm/catalog", label: "Price list", icon: "doc" },
      { href: "/app/outreach", label: "Outreach", icon: "mail" },
      { href: "/app/sales", label: "Sales team", icon: "calendar" },
    ] },
    { items: [{ href: "/app/vault", label: "Business Vault", icon: "vault", match: ["/app/vault", "/app/brand", "/app/tenders/preferences"] }, { href: "/app/schemes", label: "Government schemes", icon: "rupee" }] },
    { title: "Account", items: [
      { href: "/app/wallet", label: "Credits & plan", icon: "wallet" },
      { href: "/app/support", label: "Help & tickets", icon: "ticket" },
      { href: "/app/settings/team", label: "Team", icon: "people" },
      { href: "/app/settings/security", label: "Security", icon: "shield" },
      { href: "/app/settings/app", label: "Phone app", icon: "phone" },
      ...(isAdmin ? [{ href: "/app/settings/drive", label: "Google Drive", icon: "doc" }] : []),
      ...(["admin", "manager"].includes(role) ? [{ href: "/app/settings/sheets", label: "Google Sheets & Excel", icon: "doc" }] : []),
      ...(["admin", "manager"].includes(role) ? [{ href: "/app/settings/assistants", label: "AI assistants (ChatGPT, Claude)", icon: "sparkle" }] : []),
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
            <Link href="/app/wallet" className={`chip ${balance <= 0 ? "bad" : balance < 100 ? "warn" : "info"}`} title={balance < 100 ? "Low balance — top up to keep AI reading, bid files and outreach running" : "Credits left (1 credit = ₹1)"} style={{ gap: 6, fontWeight: 700, textDecoration: "none" }}>
              <Icon name="wallet" size={14} />{balance.toLocaleString("en-IN", { maximumFractionDigits: 2 })} credits{balance < 100 ? " · Top up" : ""}
            </Link>
            <div className="user-pill">
              <span className="small muted">{user.email}</span>
              <form action={signOut}><button className="ghost sm" title="Sign out" aria-label="Sign out" style={{ borderRadius: 99, padding: 6 }}><Icon name="logout" size={16} /></button></form>
            </div>
            <MenuButton />
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
      {isPlatformAdmin && <CaptchaDesk />}
    </div>
  );
}
