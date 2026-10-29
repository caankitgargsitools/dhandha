"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { runJson } from "@/lib/ai";
import { sitePrompt, cleanSiteText } from "@/lib/site";

export async function saveSite(site) {
  const { supabase, company, role } = await getContext();
  if (!["admin", "manager"].includes(role)) return { error: "Only admins and managers can edit the website." };
  const color = /^#[0-9a-f]{6}$/i.test(site?.color || "") ? site.color : "#4f46e5";
  const { data: slug, error } = await supabase.rpc("site_save", { p_company: company.id, p: { ...site, color } });
  if (error) return { error: error.message };
  // the site's enquiry form is the website widget; make one if the business has none yet
  const { data: w } = await supabase.from("web_widgets").select("token").eq("company_id", company.id).maybeSingle();
  if (!w) await supabase.rpc("web_widget_save", { p_company: company.id, p: { whatsapp: site.whatsapp || "" } });
  revalidatePath("/app/leads/site");
  revalidatePath(`/s/${slug}`);
  return { ok: true, slug };
}

// AI writes the texts from the Vault — the business's own data, so paid tiers only (private), 2 credits
export async function writeSiteText({ services = [] }) {
  const { supabase, tenant, company, role } = await getContext();
  if (!["admin", "manager"].includes(role)) return { error: "Only admins and managers can edit the website." };
  const [{ data: c }, { data: works }] = await Promise.all([
    supabase.from("companies").select("legal_name, trade_name, city, incorporation_date").eq("id", company.id).single(),
    supabase.from("experience_items").select("client, work_name").eq("company_id", company.id).eq("status", "completed").limit(5),
  ]);
  const ai = await runJson({
    supabase, tenantId: tenant.id, task: "site_text", private: true, maxTokens: 1500, budgetMs: 60000,
    prompt: sitePrompt({ name: c.trade_name || c.legal_name, city: c.city, since: c.incorporation_date ? new Date(c.incorporation_date).getFullYear() : null,
      services: services.map((s) => s.title).filter(Boolean).slice(0, 12), works: (works || []).map((w) => `${w.work_name} for ${w.client}`) }),
    validate: (d) => (cleanSiteText(d) ? null : "incomplete"),
  });
  if (ai.error) return { error: `The AI did not answer: ${ai.error}` };
  const { error } = await supabase.rpc("spend_credits", { p_tenant: tenant.id, p_action: "site_ai", p_qty: 1, p_ref: "site" });
  if (error) return { error: /insufficient|credits/i.test(error.message) ? "Not enough credits — top up in Credits & plan." : error.message };
  return { text: cleanSiteText(ai.data) };
}
