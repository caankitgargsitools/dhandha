import { anonClient } from "@/lib/supabase/anon";
import { toIcs } from "@/lib/ics";

// The bid calendar by secret link (/api/cal/<token>.ics) for Google Calendar, Outlook and phone calendars.
export async function GET(_request, { params }) {
  const { file } = await params;
  const token = String(file || "").replace(/\.ics$/, "");
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response("not found", { status: 404 });
  const { data, error } = await anonClient().rpc("calendar_rows", { p_token: token });
  if (error || !data) return new Response("not found", { status: 404 });
  return new Response(toIcs(data.events || [], { name: `${data.company || "Dhandha"} — bids` }), {
    headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": 'inline; filename="dhandha-bids.ics"', "cache-control": "no-store" },
  });
}
