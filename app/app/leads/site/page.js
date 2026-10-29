import Link from "next/link";
import { headers } from "next/headers";
import { getContext } from "@/lib/session";
import { loadCatalog } from "@/lib/catalog";
import { siteDefaults } from "@/lib/site";
import Editor from "./Editor";

export const metadata = { title: "Your website" };
export const maxDuration = 90;

export default async function SitePage() {
  const { supabase, tenant, company, role } = await getContext();
  if (!["admin", "manager"].includes(role)) return <div className="panel">Admins and managers edit the website.</div>;
  const h = await headers();
  const origin = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : `${h.get("x-forwarded-proto") || "https"}://${h.get("host")}`;
  const [{ data: site }, { data: c }, { data: pref }, cat, { data: price }] = await Promise.all([
    supabase.from("sites").select("*").eq("company_id", company.id).maybeSingle(),
    supabase.from("companies").select("*").eq("id", company.id).single(),
    supabase.from("tender_preferences").select("services").eq("company_id", company.id).maybeSingle(),
    loadCatalog(supabase, tenant.id),
    supabase.from("price_book").select("credits").eq("action_code", "site_ai").maybeSingle(),
  ]);
  const services = (pref?.services || []).map((id) => cat.index[id]?.label).filter(Boolean);
  const initial = site ? { ...site, whatsapp: site.whatsapp || "" } : siteDefaults({ company: c, services });

  return (
    <div className="stack">
      <Link href="/app/leads/generate" className="small">Generate leads</Link>
      <div className="page-head"><div><h1>Your website</h1><p>A clean one-page website filled from your Vault — services, completed works, team and contact — with your enquiry form built in. Free; put the link on your visiting card, WhatsApp, Google profile and email signature.</p></div></div>
      <div style={{ maxWidth: 860 }}><Editor initial={initial} origin={origin} aiCost={Number(price?.credits ?? 2)} /></div>
    </div>
  );
}
