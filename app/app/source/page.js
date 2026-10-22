import Link from "next/link";
import { getContext, calDays } from "@/lib/session";
import Icon from "@/components/Icon";

// Source new business: every place new work comes from, as cards with what is waiting in each.
export default async function Source() {
  const { supabase, company, tenant } = await getContext();
  const now = new Date().toISOString();
  const [{ data: matches }, { data: leads }, { data: pages }] = await Promise.all([
    supabase.from("tender_matches").select("eligible, pending, status, tenders!inner(due_at)").eq("company_id", company.id).gt("tenders.due_at", now),
    supabase.from("leads").select("source, status, next_follow_up_at").eq("company_id", company.id).limit(5000),
    supabase.from("meta_pages").select("page_id").eq("tenant_id", tenant.id).is("revoked_at", null),
  ]);
  const open = (matches || []).filter((m) => m.eligible && !["skipped", "lost", "won"].includes(m.status));
  const ls = leads || [];
  const due = ls.filter((l) => l.next_follow_up_at && calDays(l.next_follow_up_at) <= 0 && !["converted", "junk", "not_interested"].includes(l.status)).length;
  const social = ls.filter((l) => ["facebook", "instagram"].includes(l.source)).length;
  const linkedin = ls.filter((l) => l.source === "linkedin").length;
  const cards = [
    { href: "/app/tenders", icon: "tender", title: "Tenders", text: "Government tenders from CPPP, GeM and state portals that fit what you do, scored against your Vault.", status: `${open.length} worth bidding${open.some((m) => m.pending) ? ` · ${open.filter((m) => m.pending).length} need answers` : ""}`, ok: open.length > 0 },
    { href: "/app/leads", icon: "leads", title: "Leads", text: "Your prospects: added, imported, tender winners and newly registered companies.", status: `${ls.length} leads${due ? ` · ${due} follow-ups due` : ""}`, ok: !due },
    { href: "/app/settings/facebook", icon: "leads", title: "Facebook & Instagram", text: "People who fill your lead-ad forms arrive in Leads within minutes.", status: (pages || []).length ? `${pages.length} Page${pages.length === 1 ? "" : "s"} connected · ${social} leads` : "Not connected", ok: (pages || []).length > 0 },
    { href: "/app/leads/linkedin", icon: "people", title: "LinkedIn", text: "Bring in your LinkedIn connections as leads — from LinkedIn's own export, free.", status: linkedin ? `${linkedin} connections imported` : "Not imported yet", ok: linkedin > 0 },
  ];
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Source new business</h1><p>Every place new work for {company.legal_name} comes from.</p></div></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {cards.map((x) => (
          <Link key={x.href} href={x.href} className="panel stack-sm" style={{ color: "inherit", textDecoration: "none" }}>
            <div className="row between" style={{ flexWrap: "nowrap" }}>
              <span className="row" style={{ gap: 8 }}><Icon name={x.icon} size={18} style={{ color: "var(--madder)" }} /><strong>{x.title}</strong></span>
              <Icon name="arrow" size={16} />
            </div>
            <p className="small muted" style={{ margin: 0 }}>{x.text}</p>
            <span className={`chip ${x.ok ? "ok" : "warn"}`} style={{ alignSelf: "flex-start" }}>{x.status}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
