import { anonClient } from "@/lib/supabase/anon";

// RFC 8058 one-click unsubscribe (mail apps POST here from the List-Unsubscribe header).
export async function POST(request) {
  const t = new URL(request.url).searchParams.get("t") || "";
  if (/^[0-9a-f-]{36}$/i.test(t)) await anonClient().rpc("outreach_unsubscribe", { p_token: t });
  return new Response("unsubscribed");
}
