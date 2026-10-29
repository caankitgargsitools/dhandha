"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { STARTERS, cleanShortcut } from "@/lib/savedReplies";

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

// Saved replies: add / change / archive one, count a use, or add the starter set.
export async function saveReply(prev, formData) {
  const { supabase, tenant, role } = await getContext();
  if (["viewer", "disabled"].includes(role)) return { error: "Viewers cannot change saved replies." };
  const title = String(formData.get("title") || "").trim(), body = String(formData.get("body") || "").trim();
  if (!title || !body) return { error: "Give the reply a title and its text." };
  const { error } = await supabase.rpc("saved_reply_save", { p_tenant: tenant.id, p_id: formData.get("id") || null, p_title: title, p_body: body,
    p_shortcut: cleanShortcut(formData.get("shortcut")), p_archived: formData.get("archived") === "on" });
  if (error) return { error: msg(error) };
  revalidatePath("/app/inbox/replies");
  revalidatePath("/app/inbox");
  return { ok: true, message: "Saved." };
}

export async function replyUsed(id) {
  const { supabase } = await getContext();
  await supabase.rpc("saved_reply_used", { p_id: id });
}

export async function addStarterReplies() {
  const { supabase, tenant, role } = await getContext();
  if (["viewer", "disabled"].includes(role)) return;
  const { data: have } = await supabase.from("saved_replies").select("shortcut").eq("tenant_id", tenant.id);
  const taken = new Set((have || []).map((r) => r.shortcut));
  for (const s of STARTERS.filter((x) => !taken.has(x.shortcut))) {
    await supabase.rpc("saved_reply_save", { p_tenant: tenant.id, p_id: null, p_title: s.title, p_body: s.body, p_shortcut: s.shortcut, p_archived: false });
  }
  revalidatePath("/app/inbox/replies");
  revalidatePath("/app/inbox");
}
