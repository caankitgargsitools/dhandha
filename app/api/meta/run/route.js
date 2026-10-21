import { anonClient } from "@/lib/supabase/anon";
import { fetchLead } from "@/lib/meta";
import { leadFromMetaFields } from "@/lib/social";
import { scoreLead } from "@/lib/leads";

export const maxDuration = 60;

// Woken by the database (pg_net) with the worker key from Vault; fetches each queued lead from Meta.
export async function POST(request) {
  const key = request.headers.get("x-worker-key") || "";
  if (!key) return new Response("forbidden", { status: 403 });
  const supabase = anonClient();
  const { data: jobs, error } = await supabase.rpc("meta_claim", { p_key: key, p_limit: 40 });
  if (error) return new Response(/bad worker key/.test(error.message) ? "forbidden" : "error", { status: /bad worker key/.test(error.message) ? 403 : 500 });
  const results = [];
  for (const j of jobs) {
    try {
      const raw = await fetchLead(j.leadgen_id, j.token);
      const lead = leadFromMetaFields(raw.field_data);
      const platform = raw.platform === "ig" ? "ig" : "fb";
      const s = scoreLead({ ...lead, source: platform === "ig" ? "instagram" : "facebook" }, j.ideal || {});
      results.push({ id: j.id, ok: true, platform, form_name: raw.form_name, lead, score: Math.min(100, s.score + 15), score_reasons: [...s.reasons, "Asked to be contacted (lead form)"] });
    } catch (e) {
      results.push({ id: j.id, ok: false, error: e.message });
    }
  }
  if (results.length) {
    const { error: e2 } = await supabase.rpc("meta_report", { p_key: key, p_results: results });
    if (e2) console.error("meta report", e2.message);
  }
  return Response.json({ done: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length });
}
