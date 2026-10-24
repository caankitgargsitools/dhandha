"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { PAID_SOURCES } from "@/lib/autopilot";

const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

export async function saveAutopilot(prev, formData) {
  const { supabase, tenant, company, isAdmin } = await getContext();
  if (!isAdmin) return { error: "Only the workspace admin can set up the autopilot." };
  const whats = formData.getAll("what").map((s) => String(s).trim().slice(0, 80));
  const areas = formData.getAll("areas").map((s) => String(s).trim().slice(0, 400));
  const queries = whats.map((what, i) => ({ what, areas: areas[i] || "" })).filter((q) => q.what && q.areas).slice(0, 5);
  const sources = formData.getAll("sources").map(String).filter((s) => PAID_SOURCES.includes(s));
  const row = {
    company_id: company.id, tenant_id: tenant.id,
    active: formData.get("active") === "on",
    daily_budget: num(formData.get("daily_budget"), 0, 100000, 100),
    sources, maps_queries: queries,
    min_score: num(formData.get("min_score"), 0, 100, 0),
    sequence_id: String(formData.get("sequence_id") || "") || null,
    call_enabled: formData.get("call_enabled") === "on",
    link_kind: ["meeting", "payment", "none"].includes(formData.get("link_kind")) ? formData.get("link_kind") : "meeting",
    meeting_type_id: String(formData.get("meeting_type_id") || "") || null,
    crm_auto: formData.get("crm_auto") === "on",
    updated_at: new Date().toISOString(),
  };
  if (row.active && !sources.length) return { error: "Pick at least one source of leads." };
  if (row.active && sources.includes("google_maps") && !queries.length) return { error: "For Google Maps, add what to search for and the areas." };
  const { error } = await supabase.from("lead_autopilot").upsert(row, { onConflict: "company_id" });
  if (error) return { error: error.message };
  revalidatePath("/app/leads/autopilot");
  return { message: row.active ? "Saved — the autopilot runs every morning." : "Saved. The autopilot is off." };
}

export async function runAutopilotNow() {
  const { supabase, company, isAdmin } = await getContext();
  if (!isAdmin) return { error: "Only the workspace admin can run the autopilot." };
  const { error } = await supabase.rpc("autopilot_run_now", { p_company: company.id });
  if (error) return { error: error.message };
  return { ok: true };
}
