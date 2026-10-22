"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { checkField } from "@/lib/masters";
import { cleanSheet, computeSheet } from "@/lib/costing";
import { aiFillFormats } from "@/lib/formatAi";
import { aiTiers } from "@/lib/ai";

// Answers from the tender assistant's master questions. Everything is saved to the company's masters, so the
// next tender that needs it already has it. Only the price is per tender.

const done = (matchId) => { revalidatePath(`/app/tenders/${matchId}/assistant`); revalidatePath(`/app/tenders/${matchId}`); };
const writer = (role) => (role === "viewer" ? { error: "Viewers cannot change the masters." } : null);

export async function answerMaster({ field, value, matchId }) {
  const { supabase, company, role } = await getContext();
  if (writer(role)) return writer(role);
  const c = checkField(field, value);
  if (c.error) return c;
  let row = { [field]: c.value };
  if (field === "udyam_no") row = c.value === "NO" ? { udyam_no: null, msme_category: "none" } : { udyam_no: c.value };
  if (field === "gstin") {
    const { data: co } = await supabase.from("companies").select("pan").eq("id", company.id).single();
    if (co?.pan && c.value.slice(2, 12) !== co.pan) return { error: "This GSTIN does not contain the firm's PAN — please check." };
  }
  const { error } = await supabase.from("companies").update(row).eq("id", company.id);
  if (error) return { error: error.message };
  if (["udyam_no", "msme_category", "state"].includes(field)) await supabase.rpc("rescore_company", { p_company: company.id });
  done(matchId);
  return { ok: true };
}

// Facts: turnover / net worth by year, and blanks from the tender's own formats (master.*).
export async function answerFact({ key, period = "", value, unit = null, money = false, matchId }) {
  const { supabase, tenant, company, role } = await getContext();
  if (writer(role)) return writer(role);
  if (!/^(fin\.(turnover|net_worth)|master\.[a-z0-9_]{1,60})$/.test(String(key))) return { error: "Unknown question." };
  let v = String(value ?? "").trim();
  if (!v) return { error: "Type an answer, or skip for now." };
  if (money) {
    const n = Number(v.replace(/[,₹\s]/g, ""));
    if (!Number.isFinite(n) || n < 0) return { error: "Enter the amount in rupees, e.g. 25000000." };
    v = String(Math.round(n));
  }
  const { error } = await supabase.from("company_facts").upsert(
    { tenant_id: tenant.id, company_id: company.id, key, period: String(period).slice(0, 20), value: v.slice(0, 2000), unit, source: "tender assistant" },
    { onConflict: "company_id,key,period" },
  );
  if (error) return { error: error.message };
  if (key.startsWith("fin.")) await supabase.rpc("rescore_company", { p_company: company.id });
  done(matchId);
  return { ok: true };
}

export async function addWork({ work_name, client, value_inr, end_date, matchId }) {
  const { supabase, tenant, company, role } = await getContext();
  if (writer(role)) return writer(role);
  const name = String(work_name || "").trim(), cl = String(client || "").trim(), val = Number(String(value_inr || "").replace(/[,₹\s]/g, ""));
  if (!name || !cl) return { error: "The work's name and the client are needed." };
  if (!Number.isFinite(val) || val <= 0) return { error: "Enter the contract value in rupees." };
  const { error } = await supabase.from("experience_items").insert({ tenant_id: tenant.id, company_id: company.id, work_name: name.slice(0, 300), client: cl.slice(0, 200), value_inr: val, end_date: end_date || null, status: "completed" });
  if (error) return { error: error.message };
  await supabase.rpc("rescore_company", { p_company: company.id });
  done(matchId);
  return { ok: true };
}

export async function addPerson({ name, designation, qualification, years, matchId }) {
  const { supabase, tenant, company, role } = await getContext();
  if (writer(role)) return writer(role);
  if (!String(name || "").trim()) return { error: "The person's name is needed." };
  const { error } = await supabase.from("people").insert({ tenant_id: tenant.id, company_id: company.id, name: String(name).trim().slice(0, 120), designation: String(designation || "").slice(0, 120) || null, qualification: String(qualification || "").slice(0, 160) || null, years_experience: Number(years) || null });
  if (error) return { error: error.message };
  done(matchId);
  return { ok: true };
}

// The format picker: one choice per format of the tender (a template, the tender's own wording, or "myself").
export async function chooseFormats({ matchId, choices }) {
  const { supabase, company, role } = await getContext();
  if (!["admin", "manager", "bid_preparer"].includes(role)) return { error: "Only admins, managers and bid preparers can choose formats." };
  const { data: m } = await supabase.from("tender_matches").select("id, tender_id, filled_formats").eq("id", matchId).eq("company_id", company.id).single();
  if (!m) return { error: "Tender not found." };
  const { data: reads } = await supabase.from("tender_reads").select("formats").eq("tender_id", m.tender_id).order("created_at", { ascending: false }).limit(5);
  const withText = (reads || []).find((r) => (r.formats || []).some((f) => f.text)) || reads?.[0];
  const text = Object.fromEntries((withText?.formats || []).map((f) => [f.title, f.text || ""]));
  const old = Object.fromEntries((m.filled_formats || []).map((f) => [f.title, f]));
  const KINDS = ["covering_letter", "bidder_info", "turnover", "similar_works", "key_personnel", "non_blacklisting", "mse", "custom", "price", "manual"];
  const plan = (choices || []).slice(0, 40).filter((c) => KINDS.includes(c.kind)).map((c) => ({
    title: String(c.title).slice(0, 200), page: c.page || null, kind: c.kind, text: text[c.title] || "",
    filled_text: c.kind === "custom" && old[c.title]?.kind === "custom" ? old[c.title].filled_text : undefined,
    engine: c.kind === "custom" ? old[c.title]?.engine : "library", missing: [],
  }));
  const { error } = await supabase.from("tender_matches").update({ filled_formats: plan, gaps: [] }).eq("id", matchId);
  if (error) return { error: error.message };
  done(matchId);
  return { ok: true, message: `${plan.length} format${plan.length === 1 ? "" : "s"} chosen.` };
}

// Fill the formats kept in the tender's own wording from the masters (paid AI only — company data).
export async function fillCustom({ matchId }) {
  const { supabase, tenant, company, role } = await getContext();
  if (!["admin", "manager", "bid_preparer"].includes(role)) return { error: "Only admins, managers and bid preparers can do this." };
  if (!aiTiers().some((t) => !t.free)) return { error: "Filling the tender's own wording needs a paid AI key (your company data never goes to free AI)." };
  const { data: m } = await supabase.from("tender_matches").select("id, filled_formats, tenders(*)").eq("id", matchId).eq("company_id", company.id).single();
  const plan = m?.filled_formats || [];
  const todo = plan.filter((p) => p.kind === "custom" && !p.filled_text);
  if (!todo.length) return { ok: true, message: "Nothing to fill." };
  const { data: w } = await supabase.from("wallets").select("balance").eq("tenant_id", tenant.id).maybeSingle();
  if (Number(w?.balance || 0) < 49) return { error: "Not enough credits — this needs 49." };
  const [{ data: c }, { data: facts }, { data: works }, { data: people }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", company.id).single(),
    supabase.from("company_facts").select("key, period, value, unit").eq("company_id", company.id),
    supabase.from("experience_items").select("*").eq("company_id", company.id),
    supabase.from("people").select("*").eq("company_id", company.id),
  ]);
  const ai = await aiFillFormats({ supabase, tenantId: tenant.id, company: c, facts: facts || [], works: works || [], people: people || [], tender: m.tenders, formats: todo });
  if (ai.error) return { error: `${ai.error}` };
  todo.forEach((p, i) => { p.filled_text = ai.data.formats[i].filled_text; p.engine = ai.engine; });
  const { error: se } = await supabase.rpc("spend_credits", { p_tenant: tenant.id, p_action: "format_fill", p_qty: 1, p_ref: m.tenders.tender_ref });
  if (se) return { error: se.message };
  await supabase.from("tender_matches").update({ filled_formats: plan }).eq("id", matchId);
  done(matchId);
  return { ok: true, message: `Filled ${todo.length} format${todo.length === 1 ? "" : "s"} from your masters (49 credits). Any blank left is asked next, once.` };
}

// The price: typed directly, or the cost planner's sheet with its suggested quote.
export async function savePrice({ matchId, price, note, sheet }) {
  const { supabase, company, role } = await getContext();
  if (!["admin", "manager", "bid_preparer"].includes(role)) return { error: "Only admins, managers and bid preparers can set the price." };
  const clean = sheet ? cleanSheet(sheet) : null;
  const amount = price !== undefined && price !== null && String(price).trim() !== "" ? Number(String(price).replace(/[,₹\s]/g, "")) : clean ? computeSheet(clean).quote : NaN;
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter the price you will quote (in rupees, before GST)." };
  const row = { quoted_price: Math.round(amount), price_note: note ? String(note).slice(0, 500) : null, priced_at: new Date().toISOString() };
  if (clean) row.cost_sheet = clean;
  const { error } = await supabase.from("tender_matches").update(row).eq("id", matchId).eq("company_id", company.id);
  if (error) return { error: error.message };
  done(matchId);
  return { ok: true };
}

// Planner autosave (no price yet).
export async function saveSheet({ matchId, sheet }) {
  const { supabase, company, role } = await getContext();
  if (role === "viewer") return { error: "Viewers cannot do this." };
  const { error } = await supabase.from("tender_matches").update({ cost_sheet: cleanSheet(sheet) }).eq("id", matchId).eq("company_id", company.id);
  return error ? { error: error.message } : { ok: true };
}
