import Link from "next/link";
import { getContext, daysLeft } from "@/lib/session";
import Icon from "@/components/Icon";

const PROFILE = ["legal_name", "constitution", "pan", "gstin", "incorporation_date", "registered_address", "city", "state", "pincode", "email", "phone", "signatory_name", "signatory_designation", "signatory_mobile", "bank_name", "bank_account", "bank_ifsc"];

// Business Vault home: every part of the company's master data as a card, with how complete it is.
export default async function Vault() {
  const { supabase, company } = await getContext();
  const [{ data: c }, { data: docs }, { count: facts }, { count: works }, { count: people }, { data: brand }, { data: pref }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", company.id).single(),
    supabase.from("documents").select("valid_until").eq("company_id", company.id).eq("status", "active"),
    supabase.from("company_facts").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    supabase.from("experience_items").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    supabase.from("people").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    supabase.from("brand_assets").select("kind").eq("company_id", company.id),
    supabase.from("tender_preferences").select("services, custom_keywords").eq("company_id", company.id).maybeSingle(),
  ]);
  const filled = PROFILE.filter((k) => c?.[k]).length;
  const expiring = (docs || []).filter((d) => d.valid_until && daysLeft(d.valid_until) <= 30).length;
  const kinds = new Set((brand || []).map((b) => b.kind));
  const services = (pref?.services || []).length + (pref?.custom_keywords || []).length;
  const cards = [
    { href: "/app/tenders/preferences", icon: "briefcase", title: "What we do", text: "Industries and services — decides which tenders and leads reach you.", status: services ? `${services} chosen` : "Not set", ok: !!services },
    { href: "/app/vault/profile", icon: "building", title: "Company profile", text: "Legal name, PAN, GSTIN, address, signatory, bank for EMD refunds.", status: `${filled} of ${PROFILE.length} filled`, ok: filled === PROFILE.length },
    { href: "/app/vault/documents", icon: "doc", title: "Documents", text: "Certificates and registrations, with expiry reminders.", status: `${(docs || []).length} documents${expiring ? ` · ${expiring} expiring soon` : ""}`, ok: (docs || []).length > 0 && !expiring },
    { href: "/app/vault/facts", icon: "facts", title: "Facts", text: "Turnover, net worth and every answer given to a tender — asked once.", status: `${facts || 0} saved`, ok: (facts || 0) > 0 },
    { href: "/app/vault/experience", icon: "briefcase", title: "Experience", text: "Completed and ongoing works, for similar-work criteria.", status: `${works || 0} works`, ok: (works || 0) > 0 },
    { href: "/app/vault/people", icon: "people", title: "Key people", text: "Engineers, partners and staff named in bids.", status: `${people || 0} people`, ok: (people || 0) > 0 },
    { href: "/app/brand", icon: "pen", title: "Letterhead & signature", text: "Printed on every bid; the signature only with the admin's code.", status: ["letterhead", "signature", "seal"].filter((k) => kinds.has(k)).join(", ") || "Not uploaded", ok: kinds.has("letterhead") && kinds.has("signature") },
  ];
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Business Vault</h1><p>Everything about {company.legal_name} that tenders and leads need, kept in one place. Fill it once; every bid uses it.</p></div></div>
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
