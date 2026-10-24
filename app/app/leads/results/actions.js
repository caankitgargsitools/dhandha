"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { SOURCES } from "@/lib/leads";

// Money spent on a source outside Dhandha in a month (Google Ads bill, IndiaMART / JustDial subscription, events…),
// so Results by source shows the true cost per lead and per win. A second entry for the same month replaces it.
export async function saveSpend(prev, formData) {
  const { supabase, tenant, company, role } = await getContext();
  if (!["admin", "manager"].includes(role)) return { error: "Only admins and managers can record spend." };
  const source = String(formData.get("source") || "");
  if (!SOURCES[source]) return { error: "Pick the source." };
  const month = String(formData.get("month") || "");
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Pick the month." };
  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e8) return { error: "Enter the amount in rupees." };
  const { error } = await supabase.from("source_spend").upsert({ tenant_id: tenant.id, company_id: company.id, source, month: `${month}-01`, amount, note: String(formData.get("note") || "").slice(0, 200) || null }, { onConflict: "company_id,source,month" });
  if (error) return { error: error.message };
  revalidatePath("/app/leads/results");
  return { message: `Saved ₹${amount.toLocaleString("en-IN")} for ${SOURCES[source]}, ${month}.` };
}
