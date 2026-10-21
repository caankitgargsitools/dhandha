"use server";
import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/lib/admin";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/config";
import { crawlerCloudInit } from "@/lib/crawlerSetup";

export async function createKey(prev, formData) {
  const { supabase } = await getAdminContext();
  const { data, error } = await supabase.rpc("create_ingest_key", { p_name: String(formData.get("name") || "crawler") });
  if (error) return { error: error.message };
  revalidatePath("/admin/crawler");
  // the key is shown once, inside a ready-to-paste server setup script
  return { key: data, script: crawlerCloudInit({ supabaseUrl: SUPABASE_URL, publishableKey: SUPABASE_KEY, ingestKey: data }) };
}

export async function revokeKey(formData) {
  const { supabase } = await getAdminContext();
  await supabase.rpc("revoke_ingest_key", { p_id: String(formData.get("id")) });
  revalidatePath("/admin/crawler");
}
