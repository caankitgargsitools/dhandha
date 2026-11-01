import { anonClient } from "@/lib/supabase/anon";
import { harvestItems } from "@/lib/formatHarvest";

export const maxDuration = 120;

// Learned format catalogue (worker key; woken after each pre-check / harvest and hourly by cron format_learn): every
// tender reading not yet learned → its formats cleaned and fingerprinted (lib/formatHarvest.js) → format_learn, which
// counts a repeat or adds a new entry. Free; no AI.
export async function POST(request) {
  const key = request.headers.get("x-worker-key") || "";
  if (!key) return new Response("forbidden", { status: 403 });
  const supabase = anonClient();
  const until = Date.now() + 100000;
  const sum = { reads: 0, new: 0, repeat: 0 };
  while (Date.now() < until) {
    const { data: reads, error } = await supabase.rpc("format_learn_claim", { p_key: key, p_limit: 20 });
    if (error) return new Response(/bad worker key/.test(error.message) ? "forbidden" : "error", { status: /bad worker key/.test(error.message) ? 403 : 500 });
    if (!reads?.length) break;
    const items = reads.flatMap((r) => harvestItems(r.formats || [], r.tender || {}));
    sum.reads += reads.length;
    for (let i = 0; i < items.length; i += 60) {
      const { data, error: e } = await supabase.rpc("format_learn", { p_key: key, p_items: items.slice(i, i + 60) });
      if (e) { console.error("format_learn", e.message); break; }
      sum.new += Number(data?.new || 0); sum.repeat += Number(data?.repeat || 0);
    }
  }
  return Response.json(sum);
}
