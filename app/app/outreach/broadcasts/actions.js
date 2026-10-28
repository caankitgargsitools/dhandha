"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";

const msg = (e) => String(e?.message || e).replace(/^.*?ERROR:\s*/, "");
const filterOf = (f) => ({
  statuses: (f.statuses || []).slice(0, 10), sources: (f.sources || []).slice(0, 20),
  city: String(f.city || "").trim().slice(0, 60), min_score: f.min_score ? String(Math.max(0, Math.min(100, Number(f.min_score) || 0))) : "",
  since: /^\d{4}-\d{2}-\d{2}$/.test(f.since || "") ? f.since : "",
});

export async function previewBroadcast(f) {
  const { supabase, company } = await getContext();
  const { data, error } = await supabase.rpc("broadcast_preview", { p_company: company.id, p_filter: filterOf(f) });
  return error ? { error: msg(error) } : data;
}

export async function sendBroadcast(f) {
  const { supabase, company } = await getContext();
  const { data, error } = await supabase.rpc("broadcast_send", {
    p_company: company.id, p_name: f.name || "", p_template: String(f.template || "").trim().toLowerCase(), p_lang: f.lang || "en", p_filter: filterOf(f),
  });
  if (error) return { error: msg(error) };
  revalidatePath("/app/outreach/broadcasts");
  return data;
}
