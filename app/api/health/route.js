import { anonClient } from "@/lib/supabase/anon";

export const maxDuration = 60;

// Live self-check, woken by the database (private.health_run) with the worker key. Tests the outside services the
// site depends on and reports to private.health_checks. Only names and yes/no go back — never a key's value.
const KEYS = ["GOOGLE_MAPS_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "RESEND_API_KEY", "OUTREACH_FROM_EMAIL", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "META_APP_ID", "META_APP_SECRET"];

async function routes(key) {
  if (!key) return { name: "google_routes", ok: false, detail: { error: "GOOGLE_MAPS_API_KEY is not set" } };
  const r = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "originIndex,destinationIndex,duration,distanceMeters,condition" },
    body: JSON.stringify({ origins: [{ waypoint: { address: "Sector 3, Noida, Uttar Pradesh" } }], destinations: [{ waypoint: { address: "Connaught Place, New Delhi" } }], travelMode: "DRIVE", routingPreference: "TRAFFIC_UNAWARE", regionCode: "IN" }),
    signal: AbortSignal.timeout(15000),
  }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: { message: e.message } }) }));
  const j = await r.json().catch(() => null);
  const e = Array.isArray(j) ? j[0] : null;
  if (r.ok && e?.duration) return { name: "google_routes", ok: true, detail: { minutes: Math.round(parseInt(e.duration, 10) / 60), km: Math.round((e.distanceMeters || 0) / 1000) } };
  return { name: "google_routes", ok: false, detail: { status: r.status, error: (j?.error?.message || e?.error?.message || JSON.stringify(j)).slice(0, 400), reason: j?.error?.details?.find?.((d) => d.reason)?.reason || null } };
}

// Google Route Optimization (fleet planning). Google documents it as OAuth-only; this records what it says to the key.
async function routeOptimization(key) {
  if (!key) return { name: "google_route_optimization", ok: false, detail: { error: "GOOGLE_MAPS_API_KEY is not set" } };
  const r = await fetch("https://routeoptimization.googleapis.com/v1/projects/-:optimizeTours", {
    method: "POST",
    headers: { "content-type": "application/json", "X-Goog-Api-Key": key },
    body: JSON.stringify({ model: { shipments: [{ deliveries: [{ arrivalLocation: { latitude: 28.58, longitude: 77.31 } }] }], vehicles: [{ startLocation: { latitude: 28.63, longitude: 77.22 } }] } }),
    signal: AbortSignal.timeout(15000),
  }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: { message: e.message } }) }));
  const j = await r.json().catch(() => null);
  return { name: "google_route_optimization", ok: !!r.ok, detail: r.ok ? { routes: j?.routes?.length ?? 0 } : { status: r.status, error: String(j?.error?.message || JSON.stringify(j)).slice(0, 400) } };
}

export async function POST(request) {
  const key = request.headers.get("x-worker-key") || "";
  if (!key) return new Response("forbidden", { status: 403 });
  const supabase = anonClient();
  const { error } = await supabase.rpc("health_report", { p_key: key, p_results: null });
  if (error) return new Response("forbidden", { status: 403 });
  const results = [
    { name: "env", ok: true, detail: Object.fromEntries(KEYS.map((k) => [k, !!process.env[k]])) },
    await routes(process.env.GOOGLE_MAPS_API_KEY),
    await routeOptimization(process.env.GOOGLE_MAPS_API_KEY),
  ];
  await supabase.rpc("health_report", { p_key: key, p_results: results });
  return Response.json({ ok: true, checks: results.length });
}
