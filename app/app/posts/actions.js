"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { loadCatalog } from "@/lib/catalog";
import { runJson, aiTiers } from "@/lib/ai";
import { planMonth, templatePost, aiPostPrompt, cleanAiPost, CHANNELS, TONES } from "@/lib/contentPlan";

const CAN = ["admin", "manager"];
const txt = (v, n) => String(v || "").trim().slice(0, n) || null;

// what the posts may say about the firm: public facts only (name, city, services, titles of completed works)
async function firmFacts(supabase, tenant, company) {
  const [{ data: c }, { data: pref }, cat, { data: works }, { data: voice }] = await Promise.all([
    supabase.from("companies").select("legal_name, trade_name, city").eq("id", company.id).maybeSingle(),
    supabase.from("tender_preferences").select("services").eq("company_id", company.id).maybeSingle(),
    loadCatalog(supabase, tenant.id),
    supabase.from("experience_items").select("work_name, client").eq("company_id", company.id).eq("status", "completed").order("end_date", { ascending: false }).limit(12),
    supabase.from("brand_voice").select("*").eq("company_id", company.id).maybeSingle(),
  ]);
  return {
    business: c?.trade_name || c?.legal_name || company.legal_name, city: c?.city || "",
    services: (pref?.services || []).map((id) => cat.index[id]?.label).filter(Boolean), works: works || [], voice: voice || {},
  };
}

export async function saveVoice(prev, fd) {
  const { supabase, tenant, company, role } = await getContext();
  if (!CAN.includes(role)) return { error: "Only admins and managers can change the brand voice." };
  const tone = TONES[fd.get("tone")] ? fd.get("tone") : "friendly";
  const channels = fd.getAll("channels").filter((c) => CHANNELS[c]);
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("brand_voice").upsert({
    company_id: company.id, tenant_id: tenant.id, tone, audience: txt(fd.get("audience"), 200), about: txt(fd.get("about"), 400),
    say_words: txt(fd.get("say_words"), 200), avoid_words: txt(fd.get("avoid_words"), 200), hashtags: txt(fd.get("hashtags"), 200),
    languages: fd.get("hindi") === "on" ? ["en", "hi"] : ["en"], channels: channels.length ? channels : ["google"],
    per_week: Math.max(1, Math.min(7, Number(fd.get("per_week")) || 3)), updated_by: user.id, updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  revalidatePath("/app/posts");
  return { message: "Brand voice saved." };
}

// fill the month's empty post days with free drafts (templates); nothing is posted
export async function planThisMonth(prev, fd) {
  const { supabase, tenant, company, role } = await getContext();
  if (!CAN.includes(role)) return { error: "Only admins and managers plan posts." };
  const [y, m] = String(fd.get("month") || "").split("-").map(Number);
  if (!y || !m) return { error: "Pick a month." };
  const f = await firmFacts(supabase, tenant, company);
  const start = `${y}-${String(m).padStart(2, "0")}-01`, end = `${y}-${String(m).padStart(2, "0")}-31`;
  const { data: have } = await supabase.from("content_posts").select("post_on").eq("company_id", company.id).is("archived_at", null).gte("post_on", start).lte("post_on", end);
  const today = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
  const slots = planMonth({ year: y, month: m, perWeek: f.voice.per_week || 3, channels: f.voice.channels || ["google"], taken: (have || []).map((r) => r.post_on), from: today, hasWorks: f.works.length > 0 });
  if (!slots.length) return { message: "Every post day of this month is already planned." };
  let si = 0, wi = 0;
  const rows = slots.map((s) => {
    const service = f.services.length ? f.services[si++ % f.services.length] : "";
    const work = s.theme === "work" ? f.works[wi++ % Math.max(1, f.works.length)] : null;
    const t = templatePost({ theme: s.theme, business: f.business, city: f.city, service, work, occasion: s.occasion, voice: f.voice });
    return { tenant_id: tenant.id, company_id: company.id, post_on: s.post_on, channel: s.channel, theme: s.theme, title: t.title, body: t.body, hashtags: t.hashtags, engine: "template" };
  });
  const { error } = await supabase.from("content_posts").insert(rows);
  if (error) return { error: error.message };
  revalidatePath("/app/posts");
  return { message: `${rows.length} post${rows.length === 1 ? "" : "s"} planned as free drafts — open one to edit, or rewrite it with AI.` };
}

export async function savePost(prev, fd) {
  const { supabase, tenant, company, role } = await getContext();
  if (!CAN.includes(role)) return { error: "Only admins and managers edit posts." };
  const id = String(fd.get("id") || "");
  const channel = CHANNELS[fd.get("channel")] ? fd.get("channel") : "google";
  const row = { post_on: fd.get("post_on"), channel, theme: txt(fd.get("theme"), 20) || "tip", title: txt(fd.get("title"), 120), body: String(fd.get("body") || "").slice(0, 3000), hashtags: txt(fd.get("hashtags"), 200), updated_at: new Date().toISOString() };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.post_on || "")) return { error: "Pick a date." };
  const q = id ? supabase.from("content_posts").update(row).eq("id", id).eq("company_id", company.id)
    : supabase.from("content_posts").insert({ ...row, tenant_id: tenant.id, company_id: company.id, engine: "own" });
  const { error } = await q;
  if (error) return { error: error.message };
  revalidatePath("/app/posts");
  return { message: "Saved." };
}

export async function setPostStatus(fd) {
  const { supabase, company, role } = await getContext();
  if (!CAN.includes(role)) return;
  const status = fd.get("status");
  if (!["draft", "ready", "posted", "skipped"].includes(status)) return;
  const patch = { status, updated_at: new Date().toISOString(), ...(status === "posted" ? { posted_at: new Date().toISOString() } : {}) };
  if (fd.get("archive") === "1") patch.archived_at = new Date().toISOString();
  await supabase.from("content_posts").update(patch).eq("id", String(fd.get("id"))).eq("company_id", company.id);
  revalidatePath("/app/posts");
}

// rewrite one post with AI — public text only, so the free tier goes first; 1 credit only when a paid tier wrote it
export async function aiWritePost(id, hint) {
  const ctx = await getContext();
  const { supabase, tenant, company, role } = ctx;
  if (!CAN.includes(role)) return { error: "Only admins and managers write posts." };
  const { data: p } = await supabase.from("content_posts").select("*").eq("id", id).eq("company_id", company.id).maybeSingle();
  if (!p) return { error: "Post not found." };
  const f = await firmFacts(supabase, tenant, company);
  const work = p.theme === "work" ? f.works[0] : null;
  const prompt = aiPostPrompt({ theme: p.theme, channel: p.channel, business: f.business, city: f.city, service: f.services[0], work, occasion: p.theme === "occasion" ? p.title : "", voice: f.voice, hint: String(hint || "").slice(0, 200) });
  const ai = await runJson({ supabase, tenantId: tenant.id, task: "post_write", private: false, fast: true, maxTokens: 600, budgetMs: 45000, prompt, validate: (d) => (cleanAiPost(d, p.channel) ? null : "empty") });
  if (ai.error) return { error: `The AI did not answer: ${ai.error}` };
  const paid = !aiTiers().find((t) => t.id === ai.engine)?.free;
  if (paid) {
    const { error } = await supabase.rpc("spend_credits", { p_tenant: tenant.id, p_action: "post_ai", p_qty: 1, p_ref: `post:${id}` });
    if (error) return { error: /insufficient|credits/i.test(error.message) ? "Not enough credits — top up in Credits & plan." : error.message };
  }
  const out = cleanAiPost(ai.data, p.channel);
  await supabase.from("content_posts").update({ ...out, engine: ai.engine, updated_at: new Date().toISOString() }).eq("id", id).eq("company_id", company.id);
  revalidatePath("/app/posts");
  return { ok: true, paid, ...out };
}
