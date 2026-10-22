import Link from "next/link";
import { getContext, calDays } from "@/lib/session";
import Icon from "@/components/Icon";

// Source new business: two ways in — tenders, and generating leads.
export default async function Source() {
  const { supabase, company } = await getContext();
  const [{ data: matches }, { data: leads }] = await Promise.all([
    supabase.from("tender_matches").select("eligible, pending, status, tenders!inner(due_at)").eq("company_id", company.id).gt("tenders.due_at", new Date().toISOString()),
    supabase.from("leads").select("status, next_follow_up_at").eq("company_id", company.id).limit(5000),
  ]);
  const open = (matches || []).filter((m) => m.eligible && !["skipped", "lost", "won"].includes(m.status));
  const due = (leads || []).filter((l) => l.next_follow_up_at && calDays(l.next_follow_up_at) <= 0 && !["converted", "junk", "not_interested"].includes(l.status)).length;
  const cards = [
    { href: "/app/tenders", icon: "tender", title: "Tenders", text: "Government tenders from CPPP, GeM and state portals that fit what you do, scored against your Vault, prepared with the assistant.", status: `${open.length} worth bidding${open.some((m) => m.pending) ? ` · ${open.filter((m) => m.pending).length} need answers` : ""}`, ok: open.length > 0 },
    { href: "/app/leads/generate", icon: "leads", title: "Generate leads", text: "Tender winners, new companies, Facebook & Instagram, LinkedIn and your own lists — all into one scored list.", status: `${(leads || []).length} leads${due ? ` · ${due} follow-ups due` : ""}`, ok: !due },
  ];
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Source new business</h1><p>Where new work for {company.legal_name} comes from.</p></div></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {cards.map((x) => (
          <Link key={x.href} href={x.href} className="panel stack-sm" style={{ color: "inherit", textDecoration: "none" }}>
            <div className="row between" style={{ flexWrap: "nowrap" }}>
              <span className="row" style={{ gap: 8 }}><Icon name={x.icon} size={20} style={{ color: "var(--madder)" }} /><strong style={{ fontSize: 17 }}>{x.title}</strong></span>
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
