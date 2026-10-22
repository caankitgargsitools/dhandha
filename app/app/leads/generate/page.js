import Link from "next/link";
import { getContext, calDays } from "@/lib/session";
import Icon from "@/components/Icon";

// Generate leads: every source of new leads as a card. New sources (Apollo and the like) are added here.
export default async function GenerateLeads() {
  const { supabase, company, tenant } = await getContext();
  const [{ data: leads }, { data: pages }] = await Promise.all([
    supabase.from("leads").select("source, status, next_follow_up_at").eq("company_id", company.id).limit(5000),
    supabase.from("meta_pages").select("page_id").eq("tenant_id", tenant.id).is("revoked_at", null),
  ]);
  const ls = leads || [];
  const by = (...src) => ls.filter((l) => src.includes(l.source)).length;
  const due = ls.filter((l) => l.next_follow_up_at && calDays(l.next_follow_up_at) <= 0 && !["converted", "junk", "not_interested"].includes(l.status)).length;
  const cards = [
    { href: "/app/leads", icon: "leads", title: "Your leads", text: "Every lead from every source, scored on fit, with follow-ups and call / WhatsApp buttons.", status: `${ls.length} leads${due ? ` · ${due} follow-ups due` : ""}`, ok: !due },
    { href: "/app/leads/winners", icon: "tender", title: "Tender winners", text: "Firms that just won government contracts — they need suppliers, staff and services now.", status: `${by("tender_winner")} added`, ok: by("tender_winner") > 0 },
    { href: "/app/leads/new-companies", icon: "building", title: "New companies", text: "Companies registered with MCA in the last months, in your industries and places.", status: `${by("mca")} added`, ok: by("mca") > 0 },
    { href: "/app/settings/facebook", icon: "leads", title: "Facebook & Instagram", text: "People who fill your lead-ad forms arrive here within minutes.", status: (pages || []).length ? `${pages.length} Page${pages.length === 1 ? "" : "s"} connected · ${by("facebook", "instagram")} leads` : "Not connected", ok: (pages || []).length > 0 },
    { href: "/app/leads/linkedin", icon: "people", title: "LinkedIn", text: "Your LinkedIn connections as leads, from LinkedIn's own export. Free.", status: by("linkedin") ? `${by("linkedin")} imported` : "Not imported yet", ok: by("linkedin") > 0 },
    { href: "/app/leads?import=1", icon: "doc", title: "Import a list", text: "Excel or CSV from anywhere — IndiaMART, directories, old client lists. Duplicates are skipped.", status: `${by("upload", "indiamart", "directory")} imported`, ok: true },
  ];
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Generate leads</h1><p>Every source of new leads for {company.legal_name}. Leads from all of them land in one list.</p></div></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {cards.map((x) => (
          <Link key={x.title} href={x.href} className="panel stack-sm" style={{ color: "inherit", textDecoration: "none" }}>
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
