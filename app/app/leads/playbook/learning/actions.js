"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { runJson } from "@/lib/ai";
import { voicePrompt, normaliseTurn } from "@/lib/voiceAgent";
import { replayContext } from "@/lib/callLearning";

const msg = (e) => String(e?.message || e).replace(/^.*?ERROR:\s*/, "");
const PAGE = "/app/leads/playbook/learning";

// A lesson for Dhandha AI: for one playbook or the whole company. Works from the next call.
export async function saveLesson(l) {
  const { supabase, company, role } = await getContext();
  if (!["admin", "manager"].includes(role)) return { error: "Only admins and managers can teach Dhandha AI." };
  const { error } = await supabase.rpc("voice_lesson_save", {
    p_id: l.id || null, p_company: company.id, p_sequence: l.sequence_id || null, p_scope: l.scope === "playbook" ? "playbook" : "company",
    p_kind: l.kind === "example" ? "example" : "rule", p_situation: l.situation || "", p_bad: l.bad || "", p_better: l.better || "",
    p_session: l.session || null, p_turn: Number.isInteger(l.turn) ? l.turn : null,
  });
  if (error) return { error: msg(error) };
  revalidatePath(PAGE);
  return { ok: true };
}

// retire / restore / share (offer it to every Dhandha customer — you approve shared lessons in Admin first)
export async function setLesson(formData) {
  const { supabase } = await getContext();
  await supabase.rpc("voice_lesson_set", { p_id: formData.get("id"), p_action: formData.get("action") });
  revalidatePath(PAGE);
}

// What Dhandha AI would say now at this point of a past call, with today's lessons (and a lesson still being
// written, so it can be tried before saving). Paid AI only (what clients say is private); 1 credit.
export async function replayTurn(token, idx, draft = null) {
  const { supabase, tenant, company, role } = await getContext();
  if (!["admin", "manager"].includes(role)) return { error: "Only admins and managers can replay calls." };
  const { data: s } = await supabase.from("voice_sessions").select("token, company_id, sequence_id, config, transcript, lead_id, leads(name, contact_person, city)")
    .eq("token", token).eq("company_id", company.id).maybeSingle();
  if (!s) return { error: "Call not found." };
  const ctx = replayContext(s.transcript || [], idx);
  if (!ctx) return { error: "Pick one of Dhandha AI's lines." };
  const { data: rows } = await supabase.from("voice_lessons").select("kind, situation, bad, better, scope, sequence_id, company_id, tenant_id").eq("status", "active");
  const rank = { playbook: 0, company: 1, global: 2 };
  const lessons = (rows || []).filter((l) => l.scope === "global" || (l.company_id === company.id && (l.scope === "company" || l.sequence_id === s.sequence_id)))
    .sort((a, b) => rank[a.scope] - rank[b.scope]);
  if (draft?.better?.trim()) lessons.unshift({ kind: draft.kind, situation: draft.situation, bad: draft.bad, better: draft.better });
  const lead = s.leads ? { name: s.leads.name, contact: s.leads.contact_person, city: s.leads.city } : null;
  const ai = await runJson({
    supabase, tenantId: tenant.id, task: "voice_replay", private: true, maxTokens: 400, budgetMs: 30000,
    prompt: voicePrompt({ config: s.config || {}, lead, history: ctx.history, heard: ctx.heard, lessons }),
    validate: (d) => (!normaliseTurn(d) ? "no reply" : null),
  });
  if (ai.error) return { error: `The AI did not answer: ${ai.error}` };
  const { error: se } = await supabase.rpc("spend_credits", { p_tenant: tenant.id, p_action: "voice_replay", p_qty: 1, p_ref: String(token).slice(0, 8) });
  if (se) return { error: msg(se) };
  const t = normaliseTurn(ai.data);
  return { reply: t.reply, end: t.end, original: ctx.original, heard: ctx.heard };
}
