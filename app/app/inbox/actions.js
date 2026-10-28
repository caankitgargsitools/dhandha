"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";

const msg = (e) => String(e?.message || e).replace(/^.*?ERROR:\s*/, "");

// Answer a client from Dhandha: free text inside 24 h of their last message, else an approved template.
export async function sendReply(threadId, text, template, lang) {
  const { supabase, role } = await getContext();
  if (["viewer", "disabled"].includes(role)) return { error: "Viewers cannot send messages." };
  const { error } = await supabase.rpc("wa_reply", { p_thread: threadId, p_text: text || "", p_template: template || null, p_lang: lang || "en" });
  if (error) return { error: msg(error) };
  revalidatePath("/app/inbox");
  return { ok: true };
}

export async function threadAction(formData) {
  const { supabase } = await getContext();
  const { error } = await supabase.rpc("wa_thread_set", { p_thread: formData.get("id"), p_action: formData.get("action"), p_user: formData.get("user") || null });
  if (error) console.error("inbox", error.message);
  revalidatePath("/app/inbox");
}

export async function markRead(threadId) {
  const { supabase } = await getContext();
  await supabase.rpc("wa_thread_set", { p_thread: threadId, p_action: "read", p_user: null });
}
