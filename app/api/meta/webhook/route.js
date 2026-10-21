import { anonClient } from "@/lib/supabase/anon";

// Meta's webhook check: echo the challenge when the verify token matches.
export async function GET(request) {
  const u = new URL(request.url).searchParams;
  const ok = u.get("hub.mode") === "subscribe" && process.env.META_VERIFY_TOKEN && u.get("hub.verify_token") === process.env.META_VERIFY_TOKEN;
  return ok ? new Response(u.get("hub.challenge") || "") : new Response("forbidden", { status: 403 });
}

// New lead notifications. The body goes to the database untouched, which checks the signature
// against the app secret in Vault and queues each lead for the worker.
export async function POST(request) {
  const body = await request.text();
  const sig = request.headers.get("x-hub-signature-256") || "";
  if (!sig || body.length > 500_000) return new Response("bad request", { status: 400 });
  const { error } = await anonClient().rpc("meta_webhook", { p_body: body, p_signature: sig });
  if (error) {
    const bad = /bad signature/.test(error.message);
    console.error("meta webhook", error.message);
    return new Response(bad ? "bad signature" : "error", { status: bad ? 403 : 500 });
  }
  return new Response("ok");
}
