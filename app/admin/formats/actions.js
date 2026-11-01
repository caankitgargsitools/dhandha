"use server";
import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/lib/admin";

// Approve (offered first), hide (never offered), or edit a learned format.
export async function reviewFormat(formData) {
  const { supabase } = await getAdminContext();
  const status = String(formData.get("status") || "") || null;
  await supabase.rpc("format_catalog_set", {
    p_id: String(formData.get("id")), p_status: ["new", "approved", "hidden"].includes(status) ? status : null,
    p_heading: String(formData.get("heading") || "").trim() || null, p_body: String(formData.get("body") || "").trim() || null,
  });
  revalidatePath("/admin/formats");
}

export async function harvestSettings(formData) {
  const { supabase } = await getAdminContext();
  const n = formData.get("per_run");
  await supabase.rpc("format_harvest_admin", { p_per_run: n === null || n === "" ? null : Number(n), p_run_now: formData.get("run") === "1" });
  revalidatePath("/admin/formats");
}
