"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";

const ALLOWED = ["new", "shortlisted", "preparing", "skipped"];

export async function setTenderStatus(formData) {
  const { supabase } = await getContext();
  const status = String(formData.get("status"));
  if (!ALLOWED.includes(status)) return;
  await supabase.from("tender_matches").update({ status }).eq("id", String(formData.get("id")));
  revalidatePath("/app/tenders");
  revalidatePath("/app");
}
