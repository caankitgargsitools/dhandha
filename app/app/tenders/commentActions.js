"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";

// A note on a tender for the team; people ticked under "Tell" get a phone alert (trigger t_tender_comment_push)
export async function addComment(prev, formData) {
  const { supabase, tenant, company, role } = await getContext();
  if (["viewer", "disabled"].includes(role)) return { error: "Viewers cannot comment." };
  const matchId = String(formData.get("match_id") || "");
  const body = String(formData.get("body") || "").trim().slice(0, 2000);
  if (!body) return { error: "Type a comment." };
  const mentions = formData.getAll("tell").map(String).filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 20);
  const { error } = await supabase.from("tender_comments").insert({ tenant_id: tenant.id, company_id: company.id, match_id: matchId, body, mentions });
  if (error) return { error: error.message };
  revalidatePath(`/app/tenders/${matchId}`);
  return { message: mentions.length ? `Posted — ${mentions.length} told on their phone.` : "Posted.", at: Date.now() };
}

export async function removeComment({ id, matchId }) {
  const { supabase } = await getContext();
  const { error } = await supabase.from("tender_comments").update({ archived_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/app/tenders/${matchId}`);
  return { ok: true };
}
