import { anonClient } from "@/lib/supabase/anon";
import { pdfPages } from "@/lib/pdftext";
import { readTenderText } from "@/lib/tenderRules";
import { extractConditions } from "@/lib/conditions";
import { findPrerequisites } from "@/lib/prereq";

export const maxDuration = 300;

// Automatic pre-check (free): documents fetched in advance are read by the free rule engine before anyone opens the
// tender — numbers, eligibility, yes/no conditions and "Get ready before you file" go on the tender and every match is
// re-scored, so the Tenders page shows unmet mandatory conditions up front. Woken by pg_net when a fetch finishes
// (t_precheck_on_fetch) and hourly (cron tender_precheck), with the worker key. No AI here; the AI reading still runs
// when the person opens the assistant.
const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request) {
  const key = request.headers.get("x-worker-key") || "";
  if (!key) return new Response("forbidden", { status: 403 });
  const supabase = anonClient();
  const until = Date.now() + 270000;
  let done = 0;
  for (let round = 0; round < 5 && Date.now() < until - 60000; round++) {
    const { data: jobs, error } = await supabase.rpc("precheck_claim", { p_key: key, p_limit: 4 });
    if (error) return new Response(/bad worker key/.test(error.message) ? "forbidden" : "error", { status: /bad worker key/.test(error.message) ? 403 : 500 });
    if (!jobs?.length) break;
    for (const j of jobs) {
      if (Date.now() > until - 30000) break;
      try {
        const pages = [];
        for (const f of j.files || []) {
          if (!/\.pdf$/i.test(f.name) || Number(f.size) > MAX_BYTES) continue;
          const { data: b64 } = await supabase.rpc("precheck_file", { p_key: key, p_job: j.job, p_file_no: f.no });
          if (!b64) continue;
          try { pages.push(...(await pdfPages(new Uint8Array(Buffer.from(b64, "base64")))).pages); } catch {}
        }
        // nothing readable (no PDF, scanned only, too big): still report, so the job is marked pre-checked and not claimed again
        const rules = pages.length ? readTenderText(pages) : null;
        const read = !rules ? { fields: { _note: "Automatic pre-check: no readable PDF" }, required_docs: [], formats: [], risks: [], confidence: 0 } : {
          fields: { ...rules.fields, prereq: findPrerequisites(pages), _evidence: rules.evidence, _note: "Automatic pre-check (free reader)" },
          required_docs: rules.required_docs, formats: rules.formats, risks: rules.risks, confidence: rules.confidence,
        };
        const { error: re } = await supabase.rpc("precheck_report", { p_key: key, p_job: j.job, p_read: read, p_conditions: rules ? extractConditions(pages, { state: j.state }) : [] });
        if (re) console.error("precheck report", re.message); else done++;
      } catch (e) { console.error("precheck", j.job, e.message); }
    }
  }
  return Response.json({ done });
}
