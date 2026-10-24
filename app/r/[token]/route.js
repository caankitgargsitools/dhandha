import { anonClient } from "@/lib/supabase/anon";

// Tracked Google review link sent to won customers: notes the click, then opens the business's "write a review" page.
export async function GET(request, { params }) {
  const { token } = await params;
  const { data } = /^[0-9a-f-]{36}$/i.test(token) ? await anonClient().rpc("review_click", { p_token: token }) : { data: null };
  if (!data) return new Response("This review link is no longer active.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  return Response.redirect(data, 302);
}
