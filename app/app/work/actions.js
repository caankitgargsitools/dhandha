"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";

const CAN = ["admin", "manager", "bid_preparer", "telecaller", "field"];
const num = (v, lo, hi) => { const n = Number(v); return v === "" || v == null || !Number.isFinite(n) ? null : Math.max(lo, Math.min(hi, Math.round(n))); };

// a site update: progress %, note, crew, photos (already in the private bucket work-photos), place, problem flag
export async function addWorkUpdate(prev, formData) {
  const { supabase, tenant, company, role } = await getContext();
  if (!CAN.includes(role)) return { error: "Your role cannot post work updates." };
  const kind = formData.get("kind"), id = String(formData.get("id") || "");
  if (!/^[0-9a-f-]{36}$/.test(id) || !["tender", "deal"].includes(kind)) return { error: "Unknown job." };
  const table = kind === "tender" ? "tender_matches" : "deals";
  const { data: job } = await supabase.from(table).select("id").eq("id", id).eq("company_id", company.id).maybeSingle();
  if (!job) return { error: "Job not found." };
  const prefix = `${tenant.id}/${company.id}/${id}/`;
  const photos = String(formData.get("photos") || "").split("\n").map((s) => s.trim()).filter((p) => p.startsWith(prefix)).slice(0, 10);
  const note = String(formData.get("note") || "").trim().slice(0, 1000);
  const progress = num(formData.get("progress"), 0, 100), crew = num(formData.get("crew"), 0, 5000);
  if (progress == null && !note && !photos.length) return { error: "Add progress, a note or a photo." };
  const lat = Number(formData.get("lat")), lng = Number(formData.get("lng"));
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("work_updates").insert({
    tenant_id: tenant.id, company_id: company.id, [kind === "tender" ? "match_id" : "deal_id"]: id,
    progress, note: note || null, crew, crew_names: String(formData.get("crew_names") || "").trim().slice(0, 300) || null,
    photos, lat: Number.isFinite(lat) && lat ? lat : null, lng: Number.isFinite(lng) && lng ? lng : null,
    issue: formData.get("issue") === "on", created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/app/work");
  return { message: formData.get("issue") === "on" ? "Saved — your managers have been alerted." : "Update saved." };
}

// a won deal tracked as a job, with its dates (or no longer tracked)
export async function trackDeal(prev, formData) {
  const { supabase, company, role } = await getContext();
  if (!["admin", "manager"].includes(role)) return { error: "Only admins and managers can do this." };
  const id = String(formData.get("deal_id") || "");
  const on = formData.get("on") !== "0";
  const { error } = await supabase.from("deals").update({ track_work: on, work_start: formData.get("work_start") || null, work_end: formData.get("work_end") || null })
    .eq("id", id).eq("company_id", company.id).eq("stage", "won");
  if (error) return { error: error.message };
  revalidatePath("/app/work");
  return { message: on ? "Tracked as a job." : "No longer tracked." };
}

// a deal job finished (tender jobs finish from the tender page, which also adds them to Experience)
export async function finishDeal(formData) {
  const { supabase, company, role } = await getContext();
  if (!["admin", "manager"].includes(role)) return;
  await supabase.from("deals").update({ completed_on: new Date().toISOString().slice(0, 10) })
    .eq("id", String(formData.get("deal_id") || "")).eq("company_id", company.id);
  revalidatePath("/app/work");
}
