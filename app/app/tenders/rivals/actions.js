"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";

export async function followRival(formData) {
  const { supabase, company } = await getContext();
  const name = String(formData.get("name") || "").trim().slice(0, 160);
  if (name.length < 2) return;
  await supabase.rpc("rival_add", { p_company: company.id, p_name: name });
  revalidatePath("/app/tenders/rivals");
}

export async function stopRival(formData) {
  const { supabase } = await getContext();
  await supabase.rpc("rival_stop", { p_id: String(formData.get("id")) });
  revalidatePath("/app/tenders/rivals");
}
