"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { runJson, aiTiers } from "@/lib/ai";
import { KINDS, STARTERS, searchKb, askPrompt, cleanAnswer } from "@/lib/knowledge";

const CAN = ["admin", "manager", "bid_preparer"];

export async function saveArticle(prev, fd) {
  const { supabase, tenant, company, role } = await getContext();
  if (!CAN.includes(role)) return { error: "Your role can read the notes but not change them." };
  const title = String(fd.get("title") || "").trim().slice(0, 160);
  if (title.length < 3) return { error: "Give the note a title." };
  const { data: { user } } = await supabase.auth.getUser();
  const row = { kind: KINDS[fd.get("kind")] ? fd.get("kind") : "other", title, body: String(fd.get("body") || "").slice(0, 20000), tags: String(fd.get("tags") || "").trim().slice(0, 200) || null, pinned: fd.get("pinned") === "on", updated_by: user.id, updated_at: new Date().toISOString() };
  const id = String(fd.get("id") || "");
  let newId = id;
  if (id) {
    const { error } = await supabase.from("kb_articles").update(row).eq("id", id).eq("company_id", company.id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase.from("kb_articles").insert({ ...row, tenant_id: tenant.id, company_id: company.id, created_by: user.id }).select("id").single();
    if (error) return { error: error.message };
    newId = data.id;
  }
  revalidatePath("/app/knowledge");
  redirect(`/app/knowledge?a=${newId}`);
}

export async function archiveArticle(fd) {
  const { supabase, company, role } = await getContext();
  if (!CAN.includes(role)) return;
  await supabase.from("kb_articles").update({ archived_at: new Date().toISOString() }).eq("id", String(fd.get("id"))).eq("company_id", company.id);
  revalidatePath("/app/knowledge");
  redirect("/app/knowledge");
}

export async function addStarters(fd) {
  const { supabase, tenant, company, role } = await getContext();
  if (!CAN.includes(role)) return;
  const { data: have } = await supabase.from("kb_articles").select("title").eq("company_id", company.id).is("archived_at", null);
  const got = new Set((have || []).map((r) => r.title));
  const rows = STARTERS.filter((s) => !got.has(s.title)).map((s) => ({ ...s, tenant_id: tenant.id, company_id: company.id }));
  if (rows.length) await supabase.from("kb_articles").insert(rows);
  revalidatePath("/app/knowledge");
}

// "Ask": answered only from the firm's notes — private text, so paid AI tiers only; 2 credits
export async function askKb(question) {
  const { supabase, tenant, company } = await getContext();
  const q = String(question || "").trim();
  if (q.length < 4) return { error: "Type a question." };
  const { data } = await supabase.from("kb_articles").select("id, kind, title, body, tags, pinned, updated_at, archived_at").eq("company_id", company.id).is("archived_at", null).limit(500);
  const hits = searchKb(data || [], q, { limit: 6 });
  if (!hits.length) return { answer: "None of your notes mention this yet. Write a note about it so the team has the answer next time.", used: [], free: true };
  const ai = await runJson({ supabase, tenantId: tenant.id, task: "kb_ask", private: true, fast: true, maxTokens: 700, budgetMs: 60000, prompt: askPrompt(q, hits), validate: (d) => (cleanAnswer(d, hits) ? null : "empty") });
  if (ai.error) return { error: `The AI did not answer: ${ai.error}`, hits: hits.map((h) => ({ id: h.a.id, title: h.a.title })) };
  const { error } = await supabase.rpc("spend_credits", { p_tenant: tenant.id, p_action: "kb_ask", p_qty: 1, p_ref: "kb" });
  if (error) return { error: /insufficient|credits/i.test(error.message) ? "Not enough credits — top up in Credits & plan." : error.message };
  return cleanAnswer(ai.data, hits);
}
