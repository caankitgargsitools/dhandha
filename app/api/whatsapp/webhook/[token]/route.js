import { anonClient } from "@/lib/supabase/anon";

// WhatsApp Inbox webhook — one address per workspace (Outreach → Sender settings → Receive replies).
// Meta's subscribe check: echo the challenge when this address's verify token matches.
export async function GET(request, { params }) {
  const { token } = await params;
  const u = new URL(request.url).searchParams;
  if (u.get("hub.mode") !== "subscribe" || !/^[0-9a-f-]{36}$/.test(token)) return new Response("forbidden", { status: 403 });
  const { data } = await anonClient().rpc("wa_hook_verify", { p_token: token, p_verify: u.get("hub.verify_token") || "" });
  return data === true ? new Response(u.get("hub.challenge") || "") : new Response("forbidden", { status: 403 });
}

// Messages and delivery receipts. The body goes to the database untouched, which checks the signature against this
// workspace's app secret (Vault), files the message under the lead and wakes the sender and the phone alerts.
export async function POST(request, { params }) {
  const { token } = await params;
  const body = await request.text();
  const sig = request.headers.get("x-hub-signature-256") || "";
  if (!/^[0-9a-f-]{36}$/.test(token) || !sig || body.length > 1_000_000) return new Response("bad request", { status: 400 });
  const { error } = await anonClient().rpc("wa_webhook", { p_token: token, p_body: body, p_signature: sig });
  if (error) {
    const bad = /bad signature|unknown webhook|app secret not set/.test(error.message);
    console.error("whatsapp webhook", error.message);
    return new Response(bad ? "forbidden" : "error", { status: bad ? 403 : 500 });
  }
  return new Response("ok");
}
