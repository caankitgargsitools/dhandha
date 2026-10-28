"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";

export async function saveWidget(_prev, formData) {
  const { supabase, company, role } = await getContext();
  if (!["admin", "manager"].includes(role)) return { error: "Only admins and managers can set this up." };
  const domains = String(formData.get("domains") || "").split(/[\s,]+/).map((d) => d.trim()).filter(Boolean).slice(0, 10);
  const color = String(formData.get("color") || "");
  const { error } = await supabase.rpc("web_widget_save", { p_company: company.id, p: {
    enabled: formData.get("enabled") === "on", title: String(formData.get("title") || "").slice(0, 60), greeting: String(formData.get("greeting") || "").slice(0, 300),
    color: /^#[0-9a-f]{6}$/i.test(color) ? color : "#4f46e5", whatsapp: String(formData.get("whatsapp") || "").slice(0, 20), ask_email: formData.get("ask_email") === "on", domains,
  } });
  if (error) return { error: error.message };
  revalidatePath("/app/leads/website");
  return { ok: "Saved." };
}
