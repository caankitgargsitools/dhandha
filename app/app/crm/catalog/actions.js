"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";

export async function saveItem(_prev, formData) {
  const { supabase, company } = await getContext();
  const p = Object.fromEntries(["id", "name", "description", "hsn", "unit", "rate", "gst", "active"].map((k) => [k, String(formData.get(k) ?? "")]));
  p.rate = p.rate.replace(/[^0-9.]/g, "");
  if (!p.active) delete p.active;
  const { error } = await supabase.rpc("catalog_save", { p_company: company.id, p });
  revalidatePath("/app/crm/catalog");
  return error ? { error: error.message.replace(/^.*?ERROR:\s*/, "") } : { ok: "Saved." };
}
