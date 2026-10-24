import { anonClient } from "@/lib/supabase/anon";
import { runJson } from "@/lib/ai";
import { firmProfile, buildPrompt, validateAnswer, mapAnswer } from "@/lib/tenderCheck";

export const maxDuration = 300;

// AI tender check worker (hourly by pg_cron → private.ai_check_kick, or "Check now"), with the worker key. Public
// tender text + the firm's service names only, so the free Gemini tier goes first (private: false). Batches of 20.
export async function POST(request) {
  const key = request.headers.get("x-worker-key") || "";
  if (!key) return new Response("forbidden", { status: 403 });
  const body = await request.json().catch(() => ({}));
  const supabase = anonClient();
  const { data: due, error } = await supabase.rpc("ai_check_claim", { p_key: key, p_company: body.company || null });
  if (error) return new Response(/bad worker key/.test(error.message) ? "forbidden" : "error", { status: /bad worker key/.test(error.message) ? 403 : 500 });
  const until = Date.now() + 270000;
  let checked = 0;
  const runs = [];
  for (const c of due || []) {
    const profile = firmProfile(c.services || [], c.custom || []);
    for (let i = 0; i < c.items.length && Date.now() < until - 30000; i += 20) {
      const items = c.items.slice(i, i + 20);
      const r = await runJson({
        supabase, tenantId: c.tenant_id, task: "tender_ai_check", private: false, maxTokens: 2500,
        prompt: buildPrompt(profile, items), validate: (d) => validateAnswer(d, items.length),
        budgetMs: Math.min(120000, until - Date.now() - 10000),
      });
      runs.push({ engine: r.engine || null, attempts: (r.attempts || []).map((a) => String(a).slice(0, 160)) });
      if (r.error) { console.error("ai check", r.attempts?.join(" | ")); continue; } // unchecked ones are retried next hour
      const { data: n } = await supabase.rpc("ai_check_report", { p_key: key, p_company: c.company_id, p_results: mapAnswer(r.data, items), p_engine: r.engine });
      checked += n || 0;
    }
  }
  // which engines answered (the AI spend log is not writable from here): kept in the self-check log for review
  if (runs.length) await supabase.rpc("health_report", { p_key: key, p_results: [{ name: "ai_check_run", ok: runs.some((x) => x.engine), detail: { checked, runs } }] });
  return Response.json({ checked });
}
