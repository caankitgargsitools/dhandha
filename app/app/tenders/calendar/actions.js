"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";

export async function newCalendar() {
  const { supabase, company } = await getContext();
  await supabase.rpc("calendar_feed_new", { p_company: company.id });
  revalidatePath("/app/tenders/calendar");
}

export async function revokeCalendar(formData) {
  const { supabase } = await getContext();
  await supabase.rpc("calendar_feed_revoke", { p_token: String(formData.get("token")) });
  revalidatePath("/app/tenders/calendar");
}
