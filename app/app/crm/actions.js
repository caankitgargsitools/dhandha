"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { STAGES } from "@/lib/leads";

const STAGE_KEYS = STAGES.map(([k]) => k);
const str = (f, k, max = 200) => String(f.get(k) || "").trim().slice(0, max);
const istDate = (d) => (d ? new Date(`${d}T10:00:00+05:30`).toISOString() : null);
const money = (v) => Number(String(v || "").replace(/[^\d.]/g, "")) || null;
const canSeeAll = (role) => ["admin", "manager", "bid_preparer"].includes(role);

function done(id) {
  revalidatePath("/app/crm");
  if (id) revalidatePath(`/app/crm/${id}`);
  revalidatePath("/app/leads", "layout");
}

export async function createDeal(prev, formData) {
  const { supabase, tenant, company, role, user } = await getContext();
  if (role === "viewer") return { error: "Viewers cannot open deals." };
  const title = str(formData, "title");
  if (title.length < 3) return { error: "Say what the deal is for." };
  const owner = String(formData.get("owner_id") || "");
  const { data, error } = await supabase.from("deals").insert({
    tenant_id: tenant.id, company_id: company.id, title, value_inr: money(formData.get("value_inr")),
    lead_id: String(formData.get("lead_id") || "") || null,
    stage: STAGE_KEYS.includes(formData.get("stage")) ? String(formData.get("stage")) : "new",
    owner_id: canSeeAll(role) ? owner || user.id : user.id, created_by: user.id,
    next_action: str(formData, "next_action", 120) || null, next_action_at: istDate(str(formData, "next_at", 10)),
  }).select("id").single();
  if (error) return { error: error.message };
  done();
  redirect(`/app/crm/${data.id}`);
}

export async function moveDeal(formData) {
  const { supabase, company, role } = await getContext();
  if (role === "viewer") return;
  const id = String(formData.get("id"));
  const stage = String(formData.get("stage"));
  if (!STAGE_KEYS.includes(stage)) return;
  const patch = { stage };
  if (stage === "lost") patch.lost_reason = str(formData, "lost_reason", 200) || null;
  await supabase.from("deals").update(patch).eq("id", id).eq("company_id", company.id);
  done(id);
}

export async function updateDeal(prev, formData) {
  const { supabase, company, role, user } = await getContext();
  if (role === "viewer") return { error: "Viewers cannot change deals." };
  const id = String(formData.get("id"));
  const stage = String(formData.get("stage"));
  const patch = {
    title: str(formData, "title"), value_inr: money(formData.get("value_inr")),
    next_action: str(formData, "next_action", 120) || null, next_action_at: istDate(str(formData, "next_at", 10)),
    notes: str(formData, "notes", 4000) || null,
  };
  if (patch.title.length < 3) return { error: "Say what the deal is for." };
  if (STAGE_KEYS.includes(stage)) patch.stage = stage;
  if (stage === "lost") patch.lost_reason = str(formData, "lost_reason", 200) || null;
  const owner = String(formData.get("owner_id") || "");
  if (canSeeAll(role)) patch.owner_id = owner || null;
  else if (owner === user.id) patch.owner_id = user.id;
  const { error } = await supabase.from("deals").update(patch).eq("id", id).eq("company_id", company.id);
  if (error) return { error: error.message.includes("reassign") ? "Only managers can hand a deal to someone else." : error.message };
  done(id);
  return { message: "Saved." };
}
