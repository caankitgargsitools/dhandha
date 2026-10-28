"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";

// a new key for an AI assistant; returned once, only its hash is kept
export async function newMcpKey(name, write) {
  const { supabase, company, role } = await getContext();
  if (!["admin", "manager"].includes(role)) return { error: "Only admins and managers can connect AI assistants." };
  const { data, error } = await supabase.rpc("mcp_key_new", { p_company: company.id, p_name: String(name || "").slice(0, 60), p_write: !!write });
  if (error) return { error: error.message };
  revalidatePath("/app/settings/assistants");
  return { key: data };
}

export async function revokeMcpKey(formData) {
  const { supabase } = await getContext();
  await supabase.rpc("mcp_key_revoke", { p_id: String(formData.get("id")) });
  revalidatePath("/app/settings/assistants");
}
