import { anonClient } from "@/lib/supabase/anon";
import { COLUMNS, toCsv } from "@/lib/feed";

// A workspace's live feed (Settings → Google Sheets & Excel). The secret link is the key; a switched-off link
// answers 404. Google Sheets re-reads it about once an hour.
export async function GET(_request, { params }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token || "")) return new Response("not found", { status: 404 });
  const { data, error } = await anonClient().rpc("feed_rows", { p_token: token });
  if (error || !data) return new Response("not found", { status: 404 });
  return new Response(toCsv(data.rows, COLUMNS[data.kind]), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `inline; filename="dhandha-${data.kind}.csv"`, "cache-control": "no-store" },
  });
}
