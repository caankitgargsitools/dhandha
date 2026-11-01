"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { CRED } from "@/lib/credentials";

// One credential answer → the Vault fact cred.<key> (asked once, used on every tender that asks for it).
export async function saveCredential(prev, formData) {
  const { supabase, tenant, company, role } = await getContext();
  if (role === "viewer" || role === "disabled") return { error: "You have view-only access." };
  const key = String(formData.get("key") || ""), c = CRED[key];
  if (!c) return { error: "Unknown question." };
  let value = String(formData.get("value") ?? "").trim().slice(0, 200);
  if (c.kind === "yesno" && !["yes", "no"].includes(value)) return { error: "Choose yes or no." };
  if (c.kind === "number") { const v = Number(value.replace(/[,\s]/g, "")); if (!Number.isFinite(v) || v < 0) return { error: "Type a number." }; value = String(v); }
  if (!value) return { error: "Type an answer." };
  const { error } = await supabase.from("company_facts").upsert({ tenant_id: tenant.id, company_id: company.id, key: `cred.${key}`, period: "", value, unit: c.label, source: "user" }, { onConflict: "company_id,key,period" });
  if (error) return { error: error.message };
  revalidatePath("/app/vault/credentials");
  return { message: "Saved." };
}
