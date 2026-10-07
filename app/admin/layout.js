import Link from "next/link";
import { getAdminContext } from "@/lib/admin";
import SideNav from "@/components/SideNav";
import Icon from "@/components/Icon";
import { signOut } from "../login/actions";

export const metadata = { title: "Dhandha Admin" };

export default async function AdminLayout({ children }) {
  const { user, supabase } = await getAdminContext();
  const { data: open } = await supabase.from("tickets").select("id").in("status", ["open", "in_progress"]);
  const sections = [
    { items: [{ href: "/admin", label: "Overview", icon: "home" }] },
    { title: "Customers", items: [
      { href: "/admin/tenants", label: "Workspaces", icon: "building" },
      { href: "/admin/tickets", label: "Ticket queue", icon: "ticket", tag: open?.length ? String(open.length) : undefined },
    ] },
    { title: "Platform", items: [
      { href: "/admin/crawler", label: "Crawler", icon: "tender" },
      { href: "/admin/pricing", label: "Pricing", icon: "rupee" },
      { href: "/admin/audit", label: "Audit log", icon: "log" },
    ] },
    { title: "", items: [{ href: "/app", label: "Back to my workspace", icon: "arrow" }] },
  ];
  return (
    <div className="shell">
      <SideNav sections={sections} admin foot={<>Platform admin<br />Signed in as {user.email}</>} />
      <div className="main">
        <header className="topbar">
          <div className="row"><span className="chip info plain">Admin panel</span><span className="small muted">Changes here affect every customer.</span></div>
          <div className="user-pill">
            <span className="small muted">{user.email}</span>
            <form action={signOut}><button className="ghost sm" aria-label="Sign out" style={{ borderRadius: 99, padding: 6 }}><Icon name="logout" size={16} /></button></form>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
