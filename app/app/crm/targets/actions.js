"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";

const n = (v) => Math.max(0, Math.round(Number(String(v || "").replace(/[,₹\s]/g, "")) || 0));

export async function saveTarget(_prev, formData) {
  const { supabase, company, role } = await getContext();
  if (!["admin", "manager"].includes(role)) return { error: "Only admins and managers set targets." };
  const month = String(formData.get("month") || "");
  if (!/^\d{4}-\d{2}-01$/.test(month)) return { error: "Bad month." };
  const { error } = await supabase.rpc("sales_target_save", {
    p_company: company.id, p_user: String(formData.get("user")), p_month: month,
    p_won: n(formData.get("won")), p_meetings: n(formData.get("meetings")), p_activities: n(formData.get("activities")), p_deals: n(formData.get("deals")),
  });
  if (error) return { error: error.message };
  revalidatePath("/app/crm/targets");
  return { ok: "Saved." };
}
