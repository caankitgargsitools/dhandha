import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/config";

// Razorpay → Dhandha. The body is passed through untouched: the database checks the HMAC signature
// against the webhook secret in Supabase Vault, then credits the wallet once per payment.
export async function POST(request) {
  const body = await request.text();
  const signature = request.headers.get("x-razorpay-signature") || "";
  const eventId = request.headers.get("x-razorpay-event-id");
  if (!signature || body.length > 200_000) return new Response("bad request", { status: 400 });
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("razorpay_webhook", { p_body: body, p_signature: signature, p_event_id: eventId });
  if (error) {
    const bad = /bad signature/.test(error.message);
    console.error("razorpay webhook", error.message);
    // 400 for forgeries; 500 makes Razorpay retry anything else (e.g. secret not set yet)
    return new Response(bad ? "bad signature" : "error", { status: bad ? 400 : 500 });
  }
  return Response.json({ ok: true, result: data });
}
