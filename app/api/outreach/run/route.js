import { anonClient } from "@/lib/supabase/anon";
import { sendEmail, sendWhatsApp, emailReady } from "@/lib/outreach";

export const maxDuration = 60;

// Called by pg_cron (via pg_net) every few minutes and right after a message is queued. The x-worker-key header
// is checked inside the database against the key in Supabase Vault; this route holds no secret of its own.
export async function POST(request) {
  const key = request.headers.get("x-worker-key") || "";
  if (!key) return new Response("forbidden", { status: 403 });
  const supabase = anonClient();
  const channels = ["whatsapp", ...(emailReady() ? ["email"] : [])];
  const { data: batch, error } = await supabase.rpc("outreach_claim", { p_key: key, p_channels: channels, p_limit: 40 });
  if (error) return new Response(/bad worker key/.test(error.message) ? "forbidden" : "error", { status: /bad worker key/.test(error.message) ? 403 : 500 });
  const origin = new URL(request.url).origin;
  const results = [];
  for (let i = 0; i < batch.length; i += 5) {
    results.push(...(await Promise.all(batch.slice(i, i + 5).map(async (m) => {
      try {
        const id = m.channel === "email" ? await sendEmail(m, origin) : await sendWhatsApp(m);
        return { id: m.id, ok: true, provider_id: id };
      } catch (e) {
        return { id: m.id, ok: false, error: e.message };
      }
    }))));
  }
  if (results.length) {
    const { error: e2 } = await supabase.rpc("outreach_report", { p_key: key, p_results: results });
    if (e2) console.error("outreach report", e2.message);
  }
  return Response.json({ sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length });
}
