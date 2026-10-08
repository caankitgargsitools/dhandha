"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { leadsFromCsv, scoreLead, listField, SOURCES, LEAD_STATUS, ACTIVITY, OUTCOMES } from "@/lib/leads";

const str = (f, k, max = 200) => String(f.get(k) || "").trim().slice(0, max);
const istDate = (d, hh = "10:00") => (d ? new Date(`${d}T${hh}:00+05:30`).toISOString() : null);
const canSeeAll = (role) => ["admin", "manager", "bid_preparer", "viewer"].includes(role);

async function loadIdeal(supabase, companyId) {
  const { data } = await supabase.from("lead_preferences").select("industries, cities, states").eq("company_id", companyId).maybeSingle();
  return data || {};
}

async function runImport(ctx, source, owner, rows) {
  const ideal = await loadIdeal(ctx.supabase, ctx.company.id);
  const scored = rows.map((l) => { const s = scoreLead({ ...l, source }, ideal); return { ...l, score: s.score, score_reasons: s.reasons }; });
  return ctx.supabase.rpc("import_leads", { p_company: ctx.company.id, p_source: source, p_owner: owner || null, p_rows: scored });
}

export async function addLead(prev, formData) {
  const ctx = await getContext();
  if (ctx.role === "viewer") return { error: "Viewers cannot add leads." };
  const lead = {
    name: str(formData, "name"), contact_person: str(formData, "contact_person", 120), phone: str(formData, "phone", 40),
    email: str(formData, "email", 200).toLowerCase(), city: str(formData, "city", 80), state: str(formData, "state", 80),
    industry: str(formData, "industry", 120), website: str(formData, "website"), notes: str(formData, "notes", 2000),
  };
  if (lead.name.length < 2) return { error: "Give the business a name." };
  if (!lead.phone && !lead.email) return { error: "Add a phone number or an email so the lead can be reached." };
  const source = SOURCES[formData.get("source")] ? String(formData.get("source")) : "referral";
  const owner = String(formData.get("owner_id") || "") || ctx.user.id;
  const { data, error } = await runImport(ctx, source, owner, [lead]);
  if (error) return { error: error.message };
  if (!data.added) return { error: data.duplicates?.length ? "A lead with this phone or email already exists." : "Phone must have 10 digits, or give a valid email." };
  revalidatePath("/app/leads");
  redirect(`/app/leads/${data.ids[0]}`);
}

export async function importLeads(prev, formData) {
  const ctx = await getContext();
  if (ctx.role === "viewer") return { error: "Viewers cannot import leads." };
  const file = formData.get("file");
  if (!file || typeof file === "string" || !file.size) return { error: "Choose a CSV file. In Excel use File → Save As → CSV." };
  if (file.size > 950_000) return { error: "Keep the file under 1 MB. Split bigger sheets into parts." };
  const { leads, skipped, truncated, error: parseError } = leadsFromCsv(await file.text());
  if (parseError) return { error: parseError };
  if (!leads.length) return { error: `No usable rows: each lead needs a name and a 10-digit phone or an email. ${skipped} rows skipped.` };
  const source = SOURCES[formData.get("source")] ? String(formData.get("source")) : "upload";
  const { data, error } = await runImport(ctx, source, String(formData.get("owner_id") || "") || null, leads);
  if (error) return { error: error.message };
  revalidatePath("/app/leads");
  const dup = data.duplicates?.length || 0;
  return { message: `${data.added} leads added.${dup ? ` ${dup} already in your list.` : ""}${skipped ? ` ${skipped} rows skipped (no name or contact).` : ""}${truncated ? " Only the first 2,000 rows were read." : ""}` };
}

export async function saveIdeal(prev, formData) {
  const { supabase, tenant, company, role } = await getContext();
  if (!["admin", "manager"].includes(role)) return { error: "Only admins and managers can set the ideal client." };
  const row = {
    company_id: company.id, tenant_id: tenant.id,
    industries: listField(formData.get("industries")), cities: listField(formData.get("cities")), states: listField(formData.get("states")),
    wa_template: str(formData, "wa_template", 1000) || null, updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("lead_preferences").upsert(row);
  if (error) return { error: error.message };
  await rescoreAll(supabase, company.id, row);
  revalidatePath("/app/leads");
  return { message: "Saved. All leads were re-scored." };
}

async function rescoreAll(supabase, companyId, ideal) {
  const { data: leads } = await supabase.from("leads").select("id, phone, email, contact_person, industry, city, state, source, website, dnd, score").eq("company_id", companyId);
  const changed = (leads || []).map((l) => ({ id: l.id, old: l.score, ...scoreLead(l, ideal) })).filter((l) => l.score !== l.old);
  // small batches keep each request short; RLS limits a telecaller to their own leads anyway
  for (let i = 0; i < changed.length; i += 25) {
    await Promise.all(changed.slice(i, i + 25).map((l) => supabase.from("leads").update({ score: l.score, score_reasons: l.reasons }).eq("id", l.id)));
  }
}

export async function updateLead(prev, formData) {
  const { supabase, company, role, user } = await getContext();
  if (role === "viewer") return { error: "Viewers cannot change leads." };
  const id = String(formData.get("id"));
  const patch = {
    contact_person: str(formData, "contact_person", 120) || null, phone: str(formData, "phone", 40) || null,
    email: str(formData, "email", 200).toLowerCase() || null, city: str(formData, "city", 80) || null, state: str(formData, "state", 80) || null,
    industry: str(formData, "industry", 120) || null, website: str(formData, "website") || null, notes: str(formData, "notes", 4000) || null,
    dnd: formData.get("dnd") === "on",
    next_follow_up_at: istDate(str(formData, "follow_up", 10)),
  };
  if (LEAD_STATUS[formData.get("status")]) patch.status = String(formData.get("status"));
  const owner = String(formData.get("owner_id") || "");
  if (canSeeAll(role)) patch.owner_id = owner || null;
  else if (owner === user.id) patch.owner_id = user.id;
  const ideal = await loadIdeal(supabase, company.id);
  const { data: cur } = await supabase.from("leads").select("source").eq("id", id).single();
  const s = scoreLead({ ...patch, source: cur?.source }, ideal);
  const { error } = await supabase.from("leads").update({ ...patch, score: s.score, score_reasons: s.reasons }).eq("id", id).eq("company_id", company.id);
  if (error) return { error: error.message.includes("reassign") ? "Only managers can hand a lead to someone else." : error.message };
  revalidatePath(`/app/leads/${id}`);
  revalidatePath("/app/leads");
  return { message: "Saved." };
}

// Log a call, WhatsApp, meeting or note against a lead and/or deal; optionally set the next follow-up.
export async function logActivity(prev, formData) {
  const { supabase, tenant, company, role, user } = await getContext();
  if (role === "viewer") return { error: "Viewers cannot log activity." };
  const kind = String(formData.get("kind"));
  if (!ACTIVITY[kind] || kind === "stage") return { error: "Pick what you did." };
  const outcome = OUTCOMES[formData.get("outcome")] ? String(formData.get("outcome")) : null;
  const body = str(formData, "body", 4000) || null;
  if (kind === "note" && !body) return { error: "Write the note." };
  const leadId = String(formData.get("lead_id") || "") || null;
  const dealId = String(formData.get("deal_id") || "") || null;
  const { error } = await supabase.from("crm_activities").insert({ tenant_id: tenant.id, company_id: company.id, lead_id: leadId, deal_id: dealId, kind, outcome, body, created_by: user.id });
  if (error) return { error: error.message };
  const next = str(formData, "follow_up", 10);
  if (next && leadId) await supabase.from("leads").update({ next_follow_up_at: istDate(next) }).eq("id", leadId);
  if (next && dealId) await supabase.from("deals").update({ next_action_at: istDate(next), next_action: str(formData, "next_action", 120) || "Follow up" }).eq("id", dealId);
  if (leadId) revalidatePath(`/app/leads/${leadId}`);
  if (dealId) revalidatePath(`/app/crm/${dealId}`);
  revalidatePath("/app/leads");
  revalidatePath("/app/crm");
  return { message: "Logged." };
}

export async function createDealFromLead(prev, formData) {
  const { supabase, tenant, company, role, user } = await getContext();
  if (role === "viewer") return { error: "Viewers cannot open deals." };
  const leadId = String(formData.get("lead_id"));
  const { data: lead } = await supabase.from("leads").select("id, name, owner_id").eq("id", leadId).eq("company_id", company.id).maybeSingle();
  if (!lead) return { error: "Lead not found." };
  const title = str(formData, "title") || `Work for ${lead.name}`;
  const value = Number(String(formData.get("value_inr") || "").replace(/[^\d.]/g, "")) || null;
  const { data, error } = await supabase.from("deals").insert({
    tenant_id: tenant.id, company_id: company.id, lead_id: lead.id, title, value_inr: value, stage: "qualified",
    owner_id: canSeeAll(role) ? lead.owner_id || user.id : user.id, created_by: user.id,
    next_action: str(formData, "next_action", 120) || "Send proposal", next_action_at: istDate(str(formData, "next_at", 10)) || new Date(Date.now() + 2 * 864e5).toISOString(),
  }).select("id").single();
  if (error) return { error: error.message };
  revalidatePath("/app/crm");
  redirect(`/app/crm/${data.id}`);
}
