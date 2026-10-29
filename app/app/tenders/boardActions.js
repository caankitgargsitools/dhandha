"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { planTasks } from "@/lib/bidPlan";

const msg = (e) => String(e?.message || e).replace(/^.*?ERROR:\s*/, "");

export async function makeBidPlan(matchId) {
  const { supabase, company } = await getContext();
  const { data: m } = await supabase.from("tender_matches").select("id, tenders(due_at, prebid_on)").eq("id", matchId).eq("company_id", company.id).maybeSingle();
  if (!m?.tenders) return { error: "Tender not found." };
  const tasks = planTasks(m.tenders.due_at, m.tenders.prebid_on);
  if (!tasks.length) return { error: "This tender has closed." };
  const { error } = await supabase.rpc("bid_plan_make", { p_match: matchId, p_tasks: tasks });
  revalidatePath(`/app/tenders/${matchId}`);
  return error ? { error: msg(error) } : { ok: true };
}

export async function setBidTask(matchId, taskId, status, assign) {
  const { supabase } = await getContext();
  const { error } = await supabase.rpc("bid_task_set", { p_task: taskId, p_status: status, p_assign: assign || null });
  revalidatePath(`/app/tenders/${matchId}`);
  return error ? { error: msg(error) } : { ok: true };
}

export async function signOff(matchId, step, decision, note) {
  const { supabase } = await getContext();
  const { error } = await supabase.rpc("bid_signoff", { p_match: matchId, p_step: step, p_decision: decision, p_note: String(note || "").slice(0, 500) });
  revalidatePath(`/app/tenders/${matchId}`);
  return error ? { error: msg(error) } : { ok: true };
}
