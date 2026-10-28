"use server";
import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/lib/admin";

// Lessons every Dhandha AI call follows (the starter pack and lessons customers offered to share).
export async function saveSharedLesson(_prev, formData) {
  const { supabase } = await getAdminContext();
  const id = formData.get("id") || null;
  const { error } = await supabase.rpc("voice_lesson_admin_save", {
    p_id: id, p_kind: formData.get("kind") || "rule", p_situation: formData.get("situation") || "", p_bad: formData.get("bad") || "", p_better: formData.get("better") || "",
  });
  if (error) return { error: error.message };
  if (id && formData.get("approve") === "1") await supabase.rpc("voice_lesson_set", { p_id: id, p_action: "approve" });
  revalidatePath("/admin/voice");
  return { message: id ? "Saved." : "Added — every Dhandha AI call follows it from now." };
}

export async function setSharedLesson(formData) {
  const { supabase } = await getAdminContext();
  await supabase.rpc("voice_lesson_set", { p_id: formData.get("id"), p_action: formData.get("action") });
  revalidatePath("/admin/voice");
}
