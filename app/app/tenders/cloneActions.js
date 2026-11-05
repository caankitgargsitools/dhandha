"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { cloneFormats } from "@/lib/cloneBid";

// Start this bid from a past one: its formats (texts with the new tender's references) and its cost sheet
export async function cloneBid(prev, formData) {
  const { supabase, company, role } = await getContext();
  if (!["admin", "manager", "bid_preparer"].includes(role)) return { error: "Only admins, managers and bid preparers can do this." };
  const matchId = String(formData.get("match_id") || ""), fromId = String(formData.get("from_id") || "");
  if (!fromId) return { error: "Pick the past bid to start from." };
  const [{ data: m }, { data: f }] = await Promise.all([
    supabase.from("tender_matches").select("id, filled_formats, cost_sheet, tenders(tender_ref, title, authority, department)").eq("id", matchId).eq("company_id", company.id).maybeSingle(),
    supabase.from("tender_matches").select("id, filled_formats, cost_sheet, tenders(tender_ref, title, authority, department)").eq("id", fromId).eq("company_id", company.id).maybeSingle(),
  ]);
  if (!m || !f) return { error: "Tender not found." };
  if ((m.filled_formats || []).some((x) => x.edited_text || x.filled_text)) return { error: "This bid already has filled formats — cloning would overwrite them." };
  const plan = cloneFormats(f.filled_formats || [], f.tenders, m.tenders);
  const upd = { filled_formats: plan, ...(f.cost_sheet && !m.cost_sheet ? { cost_sheet: f.cost_sheet } : {}) };
  const { error } = await supabase.from("tender_matches").update(upd).eq("id", matchId).eq("company_id", company.id);
  if (error) return { error: error.message };
  revalidatePath(`/app/tenders/${matchId}`);
  return { message: `Started from “${String(f.tenders?.title || "").slice(0, 60)}”: ${plan.length} format${plan.length === 1 ? "" : "s"}${upd.cost_sheet ? " and the cost sheet" : ""} copied, with this tender's references. Check each one in the assistant before the bid file.` };
}
