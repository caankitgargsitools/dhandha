import { anonClient } from "@/lib/supabase/anon";

// Google Ads lead form webhook (one address per company). Google sends each form fill as JSON with the key the admin
// pasted into Google Ads; SQL checks the key and files the lead. Google wants a 200 back.
export async function POST(request, { params }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response("not found", { status: 404 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return new Response("bad request", { status: 400 });
  const { error } = await anonClient().rpc("google_ads_lead", { p_token: token, p_body: body });
  if (error) {
    if (/bad key/.test(error.message)) return new Response("forbidden", { status: 403 });
    console.error("google ads lead", error.message);
    return new Response("error", { status: 500 });
  }
  return Response.json({});
}
