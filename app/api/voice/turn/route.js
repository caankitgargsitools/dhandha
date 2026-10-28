import { anonClient } from "@/lib/supabase/anon";
import { runJson } from "@/lib/ai";
import { voicePrompt, normaliseTurn } from "@/lib/voiceAgent";

export const maxDuration = 30;

// One turn of a Dhandha AI call: the voice server (Mumbai) sends what the person said; this asks the AI for the next
// line. The server's ingest key and the session token are checked in the database. What a client says on a call is
// private, so only paid tiers answer (private: true), fastest first.
export async function POST(request) {
  const key = request.headers.get("x-ingest-key") || "";
  const body = await request.json().catch(() => ({}));
  if (!key || !body.token) return new Response("forbidden", { status: 403 });
  const supabase = anonClient();
  const { data: s, error } = await supabase.rpc("voice_session_get", { p_key: key, p_token: body.token });
  if (error || !s) return new Response("forbidden", { status: 403 });
  const ai = await runJson({
    supabase, tenantId: s.tenant_id, task: "voice_call", private: true, maxTokens: 400, budgetMs: 20000,
    prompt: voicePrompt({ config: s.config, lead: s.lead, history: body.history || [], heard: String(body.heard || "").slice(0, 1000) }),
    validate: (d) => (!normaliseTurn(d) ? "no reply" : null),
  });
  if (ai.error) return Response.json({ reply: "Sorry, the line is not clear. I will call you back shortly.", lang: "en", end: true, outcome: null, summary: `AI unavailable: ${ai.error}` });
  return Response.json(normaliseTurn(ai.data));
}
