"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { runJson, aiTiers } from "@/lib/ai";
import { tenderPdfFor, vaultFor } from "@/lib/tenderPdf";
import { freeQueries, prebidPrompt, cleanQueries } from "@/lib/prebid";

const preparer = (role) => ["admin", "manager", "bid_preparer"].includes(role);

async function load(supabase, companyId, matchId) {
  const [{ data: m }, { data: c }, { data: f }] = await Promise.all([
    supabase.from("tender_matches").select("id, tender_id, reasons, prebid_queries, tenders(*)").eq("id", matchId).eq("company_id", companyId).maybeSingle(),
    supabase.from("companies").select("legal_name, msme_category, udyam_no").eq("id", companyId).single(),
    supabase.from("company_facts").select("value").eq("company_id", companyId).eq("key", "dpiit.recognised").maybeSingle(),
  ]);
  return { m, firm: { name: c?.legal_name, msme: ["micro", "small"].includes(c?.msme_category) && !!c?.udyam_no, startup: f?.value === "yes" } };
}

async function save(supabase, companyId, matchId, queries) {
  const { error } = await supabase.from("tender_matches").update({ prebid_queries: queries.map((q, i) => ({ ...q, n: i + 1 })) }).eq("id", matchId).eq("company_id", companyId);
  revalidatePath(`/app/tenders/${matchId}`);
  return error;
}

// free: queries from the eligibility gaps the match already knows
export async function draftPrebidFree(matchId) {
  const { supabase, company, role } = await getContext();
  if (!preparer(role)) return { error: "Only admins, managers and bid preparers draft queries." };
  const { m, firm } = await load(supabase, company.id, matchId);
  if (!m) return { error: "Tender not found." };
  const free = freeQueries({ tender: m.tenders, reasons: m.reasons || [], firm });
  const kept = (m.prebid_queries || []).filter((q) => q.source !== "free");
  const all = [...free, ...kept];
  if (!all.length) return { error: "No gaps found in your eligibility for this tender — try “Read the tender with AI” for unclear clauses." };
  const e = await save(supabase, company.id, matchId, all);
  return e ? { error: e.message } : { queries: all };
}

// paid AI reads the whole tender and the Vault for restrictive or unclear clauses (5 credits)
export async function draftPrebidAi(matchId) {
  const { supabase, tenant, company, role } = await getContext();
  if (!preparer(role)) return { error: "Only admins, managers and bid preparers draft queries." };
  if (!aiTiers().some((t) => !t.free)) return { error: "Paid AI is not switched on for this site (your company data never goes to free AI)." };
  const { data: w } = await supabase.from("wallets").select("balance").eq("tenant_id", tenant.id).maybeSingle();
  if (Number(w?.balance || 0) < 5) return { error: "Not enough credits — this needs 5." };
  const { m, firm } = await load(supabase, company.id, matchId);
  if (!m) return { error: "Tender not found." };
  const [doc, vault] = await Promise.all([tenderPdfFor(supabase, m.tender_id), vaultFor(supabase, company.id)]);
  if (!doc.pdf && !doc.text) return { error: "The tender documents are not in Dhandha yet — fetch them in the assistant first." };
  const t = m.tenders;
  const ai = await runJson({
    supabase, tenantId: tenant.id, task: "prebid_ai", private: true, maxTokens: 3000, pdf: doc.pdf, text: doc.text,
    prompt: prebidPrompt({ tender: { title: t.title, ref: t.tender_ref, authority: t.authority, value_inr: t.value_inr, emd_inr: t.emd_inr, prebid_on: t.prebid_on }, firm: { ...firm, vault }, already: m.prebid_queries || [] }),
    validate: (d) => (cleanQueries(d) ? null : "no queries"),
  });
  if (ai.error) return { error: `The AI did not answer: ${ai.error}` };
  const { error: se } = await supabase.rpc("spend_credits", { p_tenant: tenant.id, p_action: "prebid_ai", p_qty: 1, p_ref: t.tender_ref });
  if (se) return { error: `Could not charge the 5 credits, so the queries are not shown: ${se.message}` };
  const all = [...(m.prebid_queries || []).filter((q) => q.source !== "ai"), ...cleanQueries(ai.data)];
  const e = await save(supabase, company.id, matchId, all);
  return e ? { error: e.message } : { queries: all };
}

export async function savePrebid(matchId, queries) {
  const { supabase, company, role } = await getContext();
  if (!preparer(role)) return { error: "Only admins, managers and bid preparers edit queries." };
  const clean = (Array.isArray(queries) ? queries : []).filter((q) => String(q.query || "").trim()).slice(0, 30)
    .map((q) => ({ clause: String(q.clause || "").slice(0, 160), page: String(q.page || "").slice(0, 20), says: String(q.says || "").slice(0, 400), query: String(q.query).slice(0, 800), why: String(q.why || "").slice(0, 400), source: q.source === "ai" || q.source === "free" ? q.source : "you" }));
  const e = await save(supabase, company.id, matchId, clean);
  return e ? { error: e.message } : { ok: true };
}
