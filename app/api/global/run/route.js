import { anonClient } from "@/lib/supabase/anon";
import { wbUrl, wbList, mapWbNotice, WB_PORTAL } from "@/lib/globalTenders";

export const maxDuration = 120;

// Global tenders (daily, cron global_tenders_daily → worker_kick, worker key): World Bank procurement notices from its
// public API → ingest_tenders (which matches them to every company like portal tenders). The result and one raw sample
// go to the self-check log so field changes on their side are noticed.
export async function POST(request) {
  const key = request.headers.get("x-worker-key") || "";
  if (!key) return new Response("forbidden", { status: 403 });
  const supabase = anonClient();
  const rows = [], seen = new Set();
  let fetched = 0, sample = null, error = null;
  for (let page = 0; page < 4; page++) {
    try {
      const res = await fetch(wbUrl(page * 500), { headers: { accept: "application/json", "user-agent": "Dhandha tender search (dhandha-amber.vercel.app)" }, signal: AbortSignal.timeout(25000) });
      if (!res.ok) { error = `World Bank answered ${res.status}`; break; }
      const list = wbList(await res.json());
      if (!list.length) break;
      fetched += list.length;
      if (!sample) sample = Object.fromEntries(Object.entries(list[0]).slice(0, 30).map(([k, v]) => [k, String(v ?? "").slice(0, 120)]));
      for (const n of list) { const t = mapWbNotice(n); if (t && !seen.has(t.tender_ref)) { seen.add(t.tender_ref); rows.push(t); } }
      if (list.length < 500) break;
    } catch (e) { error = String(e?.message || e).slice(0, 200); break; }
  }
  let ingested = null;
  for (let i = 0; i < rows.length; i += 500) {
    const { data, error: e } = await supabase.rpc("ingest_tenders", { p_key: key, p_source: WB_PORTAL, p_rows: rows.slice(i, i + 500) });
    if (e) { error = /invalid ingest key/.test(e.message) ? "forbidden" : e.message; break; }
    ingested = data;
  }
  if (error === "forbidden") return new Response("forbidden", { status: 403 });
  await supabase.rpc("health_report", { p_key: key, p_results: [{ name: "global_tenders", ok: !error && rows.length > 0, detail: { fetched, open: rows.length, ingested, error, sample } }] });
  return Response.json({ fetched, open: rows.length, error });
}
