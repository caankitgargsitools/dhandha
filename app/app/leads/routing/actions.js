"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";

export async function saveRouting(v) {
  const { supabase, company } = await getContext();
  const rules = (v.rules || []).filter((r) => r.contains?.trim() && r.user).slice(0, 50)
    .map((r) => ({ field: ["city", "state", "source", "industry"].includes(r.field) ? r.field : "city", contains: r.contains.trim().slice(0, 60), user: r.user }));
  const { error } = await supabase.rpc("lead_routing_save", { p_company: company.id, p_enabled: !!v.enabled, p_mode: v.mode, p_members: v.members || [], p_rules: rules });
  if (error) return { error: error.message.replace(/^.*?ERROR:\s*/, "") };
  revalidatePath("/app/leads/routing");
  return { ok: true };
}
