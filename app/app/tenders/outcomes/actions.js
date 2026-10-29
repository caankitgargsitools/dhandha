"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";

export async function saveResult(_prev, formData) {
  const { supabase } = await getContext();
  const id = String(formData.get("match_id") || "");
  const num = (k) => String(formData.get(k) || "").replace(/[^0-9.]/g, "");
  const { error } = await supabase.rpc("bid_result_save", { p_match: id, p: {
    result_stage: String(formData.get("result_stage") || ""), result_reason: String(formData.get("result_reason") || ""),
    our_rank: num("our_rank"), bidders: num("bidders"), quoted_price: num("quoted_price"), l1_price: num("l1_price") } });
  revalidatePath(`/app/tenders/${id}`);
  revalidatePath("/app/tenders/outcomes");
  return error ? { error: error.message } : { ok: "Result saved." };
}
