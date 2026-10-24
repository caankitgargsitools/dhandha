import "server-only";
import { pairKey } from "./scheduling.js";

// Driving times between addresses for field visits. Cost order: our own cache first (free), then one Google Routes
// API matrix call for the missing pairs (traffic-unaware = the cheapest tier), plus a 10% cushion. Without a key or
// if Google fails, the caller's fallback (45 min) is used and the slot says so.
export async function travelMinutes(supabase, tenantId, pairs) {
  const want = [...new Map(pairs.filter(([a, b]) => a && b && a !== b).map(([a, b]) => [pairKey(a, b), [a, b]])).entries()];
  const out = {};
  if (!want.length) return { travel: out, estimated: false };
  const { data: cached } = await supabase.from("travel_cache").select("pair, minutes, updated_at").eq("tenant_id", tenantId).in("pair", want.map(([k]) => k));
  const fresh = new Date(Date.now() - 30 * 86400000);
  for (const c of cached || []) if (new Date(c.updated_at) > fresh) out[c.pair] = c.minutes;
  const missing = want.filter(([k]) => out[k] === undefined);
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!missing.length) return { travel: out, estimated: false };
  if (!key) return { travel: out, estimated: true };
  // one matrix call: unique origins × unique destinations (≤ 25 × 25 elements)
  const origins = [...new Set(missing.map(([, [a]]) => a))].slice(0, 25), dests = [...new Set(missing.map(([, [, b]]) => b))].slice(0, 25);
  try {
    const r = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "originIndex,destinationIndex,duration,distanceMeters,condition" },
      body: JSON.stringify({ origins: origins.map((a) => ({ waypoint: { address: a } })), destinations: dests.map((b) => ({ waypoint: { address: b } })), travelMode: "DRIVE", routingPreference: "TRAFFIC_UNAWARE", regionCode: "IN" }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return { travel: out, estimated: true, error: `Google Routes ${r.status}` };
    const rows = await r.json();
    const save = [];
    for (const e of Array.isArray(rows) ? rows : []) {
      if (e.condition !== "ROUTE_EXISTS" || !e.duration) continue;
      const k = pairKey(origins[e.originIndex], dests[e.destinationIndex]);
      const minutes = Math.max(5, Math.ceil((parseInt(e.duration, 10) / 60) * 1.1 / 5) * 5);
      out[k] = minutes;
      save.push({ tenant_id: tenantId, pair: k, minutes, meters: e.distanceMeters || null, updated_at: new Date().toISOString() });
    }
    if (save.length) await supabase.from("travel_cache").upsert(save, { onConflict: "tenant_id,pair" });
    return { travel: out, estimated: missing.some(([k]) => out[k] === undefined) };
  } catch (e) {
    return { travel: out, estimated: true, error: e.message };
  }
}
