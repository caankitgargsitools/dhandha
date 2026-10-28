"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";

const isLead = (role) => ["admin", "manager"].includes(role);

export async function createFeed(formData) {
  const { supabase, tenant, company, role } = await getContext();
  if (!isLead(role)) return;
  const kind = formData.get("kind") === "leads" ? "leads" : "tenders";
  await supabase.from("data_feeds").insert({ tenant_id: tenant.id, company_id: company.id, kind });
  revalidatePath("/app/settings/sheets");
}

// switching a link off is permanent; make a new one to share again
export async function revokeFeed(formData) {
  const { supabase, company, role } = await getContext();
  if (!isLead(role)) return;
  await supabase.from("data_feeds").update({ revoked_at: new Date().toISOString() }).eq("token", String(formData.get("token"))).eq("company_id", company.id);
  revalidatePath("/app/settings/sheets");
}
