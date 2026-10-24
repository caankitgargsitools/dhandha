"use server";
import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/lib/admin";

// Approve (everyone can find it), reject (stays private to the workspace that added it), with optional edits.
export async function reviewTaxonomy(formData) {
  const { supabase } = await getAdminContext();
  const kw = formData.get("keywords");
  await supabase.rpc("review_taxonomy", {
    p_id: String(formData.get("id")), p_status: String(formData.get("status")),
    p_label: String(formData.get("label") || "").trim() || null,
    p_keywords: kw == null ? null : String(kw).split(",").map((w) => w.trim()).filter(Boolean).slice(0, 30),
  });
  revalidatePath("/admin/taxonomy");
  revalidatePath("/admin", "layout");
}
