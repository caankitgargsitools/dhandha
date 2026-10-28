"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { readXlsx } from "@/lib/xlsx";
import { isLinkedInExport, leadsFromLinkedIn } from "@/lib/social";
import { leadsFromRows, parseCsv, scoreLead, listField, SOURCES, LEAD_STATUS, ACTIVITY, OUTCOMES, PACKS, STAGES } from "@/lib/leads";

const str = (f, k, max = 200) => String(f.get(k) || "").trim().slice(0, max);
const istDate = (d, hh = "10:00") => (d ? new Date(`${d}T${hh}:00+05:30`).toISOString() : null);
const STAGE_KEYS = STAGES.map(([k]) => k);
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
  if (!SOURCES[formData.get("source")]) return { error: "Pick where this lead came from." };
  const source = String(formData.get("source"));
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
  if (!file || typeof file === "string" || !file.size) return { error: "Choose an Excel (.xlsx) or CSV file." };
  if (file.size > 950_000) return { error: "Keep the file under 1 MB. Split bigger sheets into parts." };
  let rows;
  try {
    rows = /\.xlsx$/i.test(file.name) ? readXlsx(Buffer.from(await file.arrayBuffer()), { maxRows: 2001 }) : parseCsv(await file.text());
  } catch (e) {
    return { error: `Could not read the file: ${e.message}. Old .xls files: save as .xlsx or CSV first.` };
  }
  // LinkedIn's own Connections.csv export is recognised by its header and kept as LinkedIn leads
  const linkedin = isLinkedInExport(rows);
  const { leads, skipped, truncated, error: parseError } = linkedin ? leadsFromLinkedIn(rows) : leadsFromRows(rows);
  if (parseError) return { error: parseError };
  if (!leads.length) return { error: `No usable rows: each lead needs a name and a 10-digit phone or an email. ${skipped} rows skipped.` };
  const source = linkedin ? "linkedin" : SOURCES[formData.get("source")] ? String(formData.get("source")) : "upload";
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
    wa_opt_in: formData.get("wa_opt_in") === "on",
    next_follow_up_at: istDate(str(formData, "follow_up", 10)),
  };
  if (LEAD_STATUS[formData.get("status")]) patch.status = String(formData.get("status"));
  // an unsubscribe is only ever switched on here, never off
  if (formData.get("email_opt_out") === "on") patch.email_opt_out = true;
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
  // one open deal per lead: if there is one already, bring it up to date instead of opening a second
  const { data: open } = await supabase.from("deals").select("id, stage").eq("lead_id", lead.id).eq("company_id", company.id).not("stage", "in", "(won,lost)").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (open) {
    const patch = {
      title, next_action: str(formData, "next_action", 120) || "Send proposal",
      next_action_at: istDate(str(formData, "next_at", 10)) || new Date(Date.now() + 2 * 864e5).toISOString(),
    };
    if (value) patch.value_inr = value;
    // deals only move forward
    if (STAGE_KEYS.indexOf(open.stage) < STAGE_KEYS.indexOf("qualified")) patch.stage = "qualified";
    const { error } = await supabase.from("deals").update(patch).eq("id", open.id).eq("company_id", company.id);
    if (error) return { error: error.message };
    revalidatePath("/app/crm");
    redirect(`/app/crm/${open.id}`);
  }
  const { data, error } = await supabase.from("deals").insert({
    tenant_id: tenant.id, company_id: company.id, lead_id: lead.id, title, value_inr: value, stage: "qualified",
    owner_id: canSeeAll(role) ? lead.owner_id || user.id : user.id, created_by: user.id,
    next_action: str(formData, "next_action", 120) || "Send proposal", next_action_at: istDate(str(formData, "next_at", 10)) || new Date(Date.now() + 2 * 864e5).toISOString(),
  }).select("id").single();
  if (error) return { error: error.message };
  revalidatePath("/app/crm");
  redirect(`/app/crm/${data.id}`);
}

export async function saveWinnerPrefs(prev, formData) {
  const { supabase, tenant, company, role } = await getContext();
  if (!["admin", "manager"].includes(role)) return { error: "Only admins and managers can change this." };
  const packs = formData.getAll("packs").map(String).filter((p) => PACKS[p]);
  const days = Math.min(730, Math.max(7, Number(formData.get("days")) || 180));
  const { error } = await supabase.from("lead_preferences").upsert({
    company_id: company.id, tenant_id: tenant.id, winner_packs: packs, winner_days: days,
    winner_min_value: Number(String(formData.get("min_value") || "").replace(/[^\d.]/g, "")) || null, updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  revalidatePath("/app/leads/winners");
  return { message: "Saved." };
}

// Adds chosen tender winners as leads. Charged per lead added (price book: lead_found); duplicates are free.
export async function addWinners(prev, formData) {
  const ctx = await getContext();
  if (ctx.role === "viewer") return { error: "Viewers cannot add leads." };
  const ids = new Set(formData.getAll("award").map(String));
  if (!ids.size) return { error: "Tick the firms you want to add." };
  if (ids.size > 100) return { error: "Add at most 100 at a time." };
  const { data: found, error: e1 } = await ctx.supabase.rpc("winner_prospects", { p_company: ctx.company.id });
  if (e1) return { error: e1.message };
  const rows = (found || []).filter((a) => ids.has(a.award_id)).map((a) => ({
    name: a.bidder_name, city: a.bidder_city, state: a.state, industry: PACKS[a.industry_pack] || null, award_id: a.award_id,
    notes: `Won "${a.title}" from ${a.authority || a.portal}${a.awarded_value ? ` for ₹${Number(a.awarded_value).toLocaleString("en-IN")}` : ""}${a.contract_date ? ` on ${a.contract_date}` : ""} (${a.portal}).${a.wins > 1 ? ` ${a.wins} wins in this period.` : ""}${a.bidder_address ? `\nAddress: ${a.bidder_address}` : ""}`,
  }));
  if (!rows.length) return { error: "Those firms are already in your leads." };
  const { data, error } = await runImport(ctx, "tender_winner", String(formData.get("owner_id") || "") || null, rows);
  if (error) return { error: /insufficient credits/i.test(error.message) ? "Not enough credits. Top up in Credits & plan." : error.message };
  revalidatePath("/app/leads", "layout");
  return { message: `${data.added} firms added to your leads.${data.duplicates?.length ? ` ${data.duplicates.length} were already there.` : ""}` };
}

export async function saveMcaPrefs(prev, formData) {
  const { supabase, tenant, company, role } = await getContext();
  if (!["admin", "manager"].includes(role)) return { error: "Only admins and managers can change this." };
  const { error } = await supabase.from("lead_preferences").upsert({
    company_id: company.id, tenant_id: tenant.id, mca_days: Math.min(365, Math.max(7, Number(formData.get("days")) || 60)),
    mca_min_capital: Number(String(formData.get("min_capital") || "").replace(/[^\d.]/g, "")) || null, updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  revalidatePath("/app/leads/new-companies");
  return { message: "Saved." };
}

// Adds chosen newly registered companies as leads. Charged per lead added (lead_found); duplicates are free.
export async function addMcaCompanies(prev, formData) {
  const ctx = await getContext();
  if (ctx.role === "viewer") return { error: "Viewers cannot add leads." };
  const cins = [...new Set(formData.getAll("cin").map(String))];
  if (!cins.length) return { error: "Tick the companies you want to add." };
  if (cins.length > 100) return { error: "Add at most 100 at a time." };
  const [{ data: found, error: e1 }, ideal] = await Promise.all([ctx.supabase.rpc("mca_prospects", { p_company: ctx.company.id }), loadIdeal(ctx.supabase, ctx.company.id)]);
  if (e1) return { error: e1.message };
  const scores = Object.fromEntries((found || []).filter((m) => cins.includes(m.cin)).map((m) => {
    const s = scoreLead({ name: m.name, email: m.has_email ? "on@file.in" : null, industry: m.activity, state: m.state, source: "mca" }, ideal);
    return [m.cin, { score: s.score, reasons: s.reasons }];
  }));
  const { data, error } = await ctx.supabase.rpc("add_mca_leads", { p_company: ctx.company.id, p_owner: String(formData.get("owner_id") || "") || null, p_cins: cins, p_scores: scores });
  if (error) return { error: /insufficient credits/i.test(error.message) ? "Not enough credits. Top up in Credits & plan." : error.message };
  revalidatePath("/app/leads", "layout");
  if (!data.added) return { error: "Those companies are already in your leads." };
  return { message: `${data.added} companies added to your leads.${data.duplicates?.length ? ` ${data.duplicates.length} were already there.` : ""}` };
}

// Google Maps / Apollo results ticked on their search pages → leads. Google Maps leads cost lead_found credits
// (Dhandha pays Google); Apollo uses the workspace's own Apollo account, so they are free here.
export async function addFoundLeads(prev, formData) {
  const ctx = await getContext();
  if (ctx.role === "viewer") return { error: "Viewers cannot add leads." };
  const source = formData.get("source") === "apollo" ? "apollo" : "google_maps";
  const picks = formData.getAll("pick").map(String).slice(0, 100);
  if (!picks.length) return { error: "Tick the ones you want to add." };
  const rows = [];
  for (const p of picks) {
    try {
      const r = JSON.parse(p);
      const keep = ["name", "contact_person", "phone", "email", "city", "state", "industry", "website", "linkedin_url", "notes"];
      rows.push(Object.fromEntries(keep.map((k) => [k, typeof r[k] === "string" ? r[k].slice(0, k === "notes" ? 1500 : 300) : null])));
    } catch { /* skip a damaged row */ }
  }
  const { data, error } = await runImport(ctx, source, String(formData.get("owner_id") || "") || null, rows.filter((r) => r.name));
  if (error) return { error: /insufficient credits/i.test(error.message) ? "Not enough credits. Top up in Credits & plan." : error.message };
  revalidatePath("/app/leads", "layout");
  return { message: `${data.added} added to your leads.${data.duplicates?.length ? ` ${data.duplicates.length} were already there.` : ""}${source === "google_maps" && data.added ? ` ${data.added * 2} credits used.` : ""}` };
}

export async function saveApolloKey(prev, formData) {
  const { supabase, tenant, isAdmin } = await getContext();
  if (!isAdmin) return { error: "Only the workspace admin can connect Apollo." };
  const { error } = await supabase.rpc("set_apollo_key", { p_tenant: tenant.id, p_key: String(formData.get("key") || "").trim() });
  if (error) return { error: error.message };
  revalidatePath("/app/leads/apollo");
  return { message: "Apollo connected." };
}

export async function disconnectApollo() {
  const { supabase, tenant } = await getContext();
  await supabase.rpc("disconnect_apollo", { p_tenant: tenant.id });
  revalidatePath("/app/leads/apollo");
}

// Data marketplace: buy ticked records, or everything matching the search (up to a limit), into Leads.
export async function buyRecords(prev, formData) {
  const ctx = await getContext();
  if (ctx.role === "viewer") return { error: "Viewers cannot buy data." };
  const set = String(formData.get("set_id"));
  const all = formData.get("mode") === "all";
  const ids = formData.getAll("rec").map(Number).filter(Number.isFinite).slice(0, 500);
  if (!all && !ids.length) return { error: "Tick the records you want, or buy everything that matches." };
  const filters = JSON.parse(String(formData.get("filters") || "{}"));
  const { data, error } = all
    ? await ctx.supabase.rpc("data_buy_matching", { p_company: ctx.company.id, p_set: set, p_q: String(formData.get("q") || ""), p_filters: filters, p_max: Math.min(500, Number(formData.get("max")) || 100) })
    : await ctx.supabase.rpc("data_buy", { p_company: ctx.company.id, p_set: set, p_ids: ids });
  if (error) return { error: /insufficient credits/i.test(error.message) ? "Not enough credits. Top up in Credits & plan." : error.message };
  revalidatePath("/app/leads", "layout");
  if (!data.bought) return { error: "Nothing new to buy — you already have these records." };
  return { message: `Bought ${data.bought} record${data.bought === 1 ? "" : "s"} for ${Number(data.credits).toLocaleString("en-IN")} credits: ${data.new_leads} new lead${data.new_leads === 1 ? "" : "s"}${data.already_leads ? `, ${data.already_leads} were already in your leads` : ""}.` };
}

// "Find email / phone": the workspace's own Apollo key looks up each lead's contact; only empty fields are filled,
// and the timeline says what was found. One lead from its page, or up to 25 at a time from the Leads page.
export async function enrichLeads(ids) {
  const { supabase, tenant, company, role } = await getContext();
  if (["viewer", "disabled", "field"].includes(role)) return { error: "Not allowed for your role." };
  const { apolloMatch } = await import("@/lib/connectors");
  const { data: key } = await supabase.rpc("apollo_key", { p_tenant: tenant.id });
  if (!key) return { error: "Connect your Apollo account first (Generate leads → Apollo)." };
  let list = Array.isArray(ids) && ids.length ? ids.slice(0, 25) : null;
  if (!list) {
    const { data } = await supabase.from("leads").select("id").eq("company_id", company.id).is("email", null).not("contact_person", "is", null)
      .not("status", "in", "(converted,junk)").order("score", { ascending: false }).limit(25);
    list = (data || []).map((l) => l.id);
  }
  if (!list.length) return { error: "No leads with a contact name and no email to look up." };
  const { data: leads } = await supabase.from("leads").select("id, name, contact_person, website, linkedin_url, email, phone, tenant_id").in("id", list).eq("company_id", company.id);
  let found = 0, tried = 0, lastError = null;
  for (const l of leads || []) {
    if (l.email && l.phone) continue;
    tried++;
    const r = await apolloMatch({ key, lead: l });
    if (r.error) { lastError = r.error; if (/key|rate limit/i.test(r.error)) break; continue; }
    const patch = {};
    if (!l.email && r.email) patch.email = r.email.toLowerCase();
    if (!l.phone && r.phone) patch.phone = r.phone;
    if (!l.linkedin_url && r.linkedin_url) patch.linkedin_url = r.linkedin_url;
    if (!Object.keys(patch).length) continue;
    const { error } = await supabase.from("leads").update(patch).eq("id", l.id).eq("company_id", company.id);
    if (error) { lastError = error.message; continue; }
    found++;
    await supabase.from("crm_activities").insert({ tenant_id: l.tenant_id, company_id: company.id, lead_id: l.id, kind: "note",
      body: `Found on Apollo: ${[patch.email && `email ${patch.email}`, patch.phone && `phone ${patch.phone}`, patch.linkedin_url && "LinkedIn profile", r.title && `(${r.title})`].filter(Boolean).join(", ")}` });
  }
  revalidatePath("/app/leads");
  for (const id of list) revalidatePath(`/app/leads/${id}`);
  return { found, tried, error: found ? null : lastError || (tried ? "Apollo had nothing new for these leads." : "These leads already have an email and a phone.") };
}
