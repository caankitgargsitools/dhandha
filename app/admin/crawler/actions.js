"use server";
import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/lib/admin";

export async function createKey(prev, formData) {
  const { supabase } = await getAdminContext();
  const { data, error } = await supabase.rpc("create_ingest_key", { p_name: String(formData.get("name") || "crawler") });
  if (error) return { error: error.message };
  revalidatePath("/admin/crawler");
  return { key: data };
}

export async function revokeKey(formData) {
  const { supabase } = await getAdminContext();
  await supabase.rpc("revoke_ingest_key", { p_id: String(formData.get("id")) });
  revalidatePath("/admin/crawler");
}
