"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { FACTS } from "@/lib/schemes";

// A yes/no answer for the schemes finder, kept in the Vault (Facts) so it is never asked again.
export async function answerScheme(formData) {
  const { supabase, tenant, company, role } = await getContext();
  const key = String(formData.get("key") || "");
  const value = formData.get("value") === "yes" ? "yes" : "no";
  if (!FACTS[key] || ["viewer", "disabled"].includes(role)) return;
  await supabase.from("company_facts").upsert(
    { tenant_id: tenant.id, company_id: company.id, key, period: "", value, unit: null, source: "schemes finder" },
    { onConflict: "company_id,key,period" },
  );
  revalidatePath("/app/schemes");
}
