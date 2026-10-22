import webpush from "web-push";
import { anonClient } from "@/lib/supabase/anon";

export const maxDuration = 60;

// Woken by the database (pg_net) with the worker key from Vault; sends queued phone notifications.
export async function POST(request) {
  const key = request.headers.get("x-worker-key") || "";
  if (!key) return new Response("forbidden", { status: 403 });
  const supabase = anonClient();
  const { data, error } = await supabase.rpc("push_claim", { p_key: key });
  if (error) return new Response(/bad worker key/.test(error.message) ? "forbidden" : "error", { status: /bad worker key/.test(error.message) ? 403 : 500 });
  if (!data?.items?.length) return Response.json({ sent: 0 });
  if (!data.public || !data.private) return Response.json({ sent: 0, note: "keys not set up yet" });
  webpush.setVapidDetails("mailto:support@dhandha.app", data.public, data.private);
  const gone = [], sent = {};
  for (const n of data.items) {
    const payload = JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: n.tag });
    sent[n.id] = 0;
    await Promise.all(n.devices.map(async (d) => {
      try {
        await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload, { TTL: 3600, urgency: n.tag === "captcha" || String(n.tag).startsWith("docs:") ? "high" : "normal" });
        sent[n.id]++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) gone.push(d.endpoint); // the phone dropped this subscription
        else console.error("push", e.statusCode, e.body || e.message);
      }
    }));
  }
  await supabase.rpc("push_report", { p_key: key, p_gone: gone, p_sent: sent });
  return Response.json({ sent: Object.values(sent).reduce((a, b) => a + b, 0), gone: gone.length });
}
