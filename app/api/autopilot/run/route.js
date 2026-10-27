import { anonClient } from "@/lib/supabase/anon";
import { placesSearch, mapPlace } from "@/lib/connectors";
import { pickBest, winnerRow, mcaRow, mapsQueries } from "@/lib/autopilot";

export const maxDuration = 300;

// Lead autopilot, woken every morning (pg_cron → private.autopilot_kick) or by "Run now", with the worker key.
// For each company due today: Google Maps searches (Dhandha's key), tender winners and new companies, scored free,
// the best within the day's budget imported (credits charged in SQL), put in the company's sequence, and logged.
export async function POST(request) {
  const key = request.headers.get("x-worker-key") || "";
  if (!key) return new Response("forbidden", { status: 403 });
  const body = await request.json().catch(() => ({}));
  const supabase = anonClient();
  const { data: due, error } = await supabase.rpc("autopilot_claim", { p_key: key, p_company: body.company || null });
  if (error) return new Response(/bad worker key/.test(error.message) ? "forbidden" : "error", { status: /bad worker key/.test(error.message) ? 403 : 500 });
  const done = [];
  for (const c of due || []) {
    let added = 0;
    const put = async (source, rows, note) => {
      const { data } = await supabase.rpc("autopilot_import", { p_key: key, p_company: c.company_id, p_source: source, p_rows: rows, p_note: note || null });
      added += Number(data?.added || 0);
    };
    const opts = { n: c.each, minScore: c.min_score, ideal: c.ideal };
    if (c.sources.includes("tender_winner")) await put("tender_winner", pickBest((c.winners || []).map(winnerRow), { ...opts, source: "tender_winner" }));
    if (c.sources.includes("mca")) await put("mca", pickBest((c.mca || []).map(mcaRow), { ...opts, source: "mca" }));
    if (c.sources.includes("google_maps")) {
      // Google Maps takes whatever the other sources could not use, so the whole day's budget goes to leads
      const want = Math.max(c.each, Number(c.total || 0) - added);
      // rotate which search goes first each day, and look past businesses already in this company's leads
      const all = mapsQueries(c.queries);
      const day = Math.floor(Date.now() / 864e5);
      const searches = all.map((_, i) => all[(i + day) % all.length]);
      const { data: seen } = await supabase.rpc("autopilot_seen", { p_key: key, p_company: c.company_id });
      const phones = new Set(seen?.phones || []), names = new Set(seen?.names || []);
      const known = (r) => phones.has(String(r.phone || "").replace(/\D/g, "").slice(-10)) || names.has(String(r.name || "").toLowerCase().replace(/[^a-z0-9]/g, ""));
      if (!searches.length) { await put("google_maps", [], "No Google Maps searches set"); continue; }
      const found = new Map();
      // a few pages per search, until there are three candidates for every lead the budget buys
      for (const q of searches) {
        let page;
        for (let i = 0; i < 3 && found.size < want * 3; i++) {
          const r = await placesSearch({ query: q, pageToken: page });
          if (r.error) { console.error("autopilot maps", r.error); break; }
          for (const p of r.places) {
            if (found.has(p.id)) continue;
            const row = { ...mapPlace(p, { industry: q.split(" in ")[0] }), address: p.formattedAddress || null };
            if (!known(row)) found.set(p.id, row);
          }
          if (!(page = r.next)) break;
        }
        if (found.size >= want * 3) break;
      }
      const rows = pickBest([...found.values()].filter((r) => r.phone), { ...opts, n: want, source: "google_maps" }).map(({ _id, _address, _rating, _reviews, ...r }) => r);
      await put("google_maps", rows, `${searches.length} search${searches.length > 1 ? "es" : ""}`);
    }
    done.push(c.company_id);
  }
  return Response.json({ companies: done.length });
}
