import { anonClient } from "@/lib/supabase/anon";
import { handleRpc, keyFrom } from "@/lib/mcp";

// The AI-assistant plug-in (MCP over Streamable HTTP, stateless: every POST carries its own key and gets JSON back).
// The key is checked and every tool runs inside the database (mcp_call), scoped to the key's company.
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type, mcp-protocol-version, mcp-session-id", "access-control-allow-methods": "POST, GET, OPTIONS" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS } });

export async function POST(request) {
  const key = keyFrom(request.headers.get("authorization"), request.url);
  if (!key) return json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Missing Dhandha key: make one in Dhandha → Settings → AI assistants" } }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400); }
  const db = anonClient();
  const call = async (tool, args) => {
    // counted before it runs (its own transaction), so failed calls count against the limit too
    const { error: te } = await db.rpc("mcp_tick", { p_key: key, p_tool: tool });
    if (te) throw new Error(te.message);
    const { data, error } = await db.rpc("mcp_call", { p_key: key, p_tool: tool, p_args: args });
    if (error) throw new Error(error.message);
    return data;
  };
  const batch = Array.isArray(body) ? body : [body];
  if (batch.length > 20) return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "At most 20 messages at once" } }, 400);
  // a bad key fails on initialize already, so the assistant shows the error when connecting
  if (batch.some((m) => m?.method === "initialize")) {
    const { error } = await db.rpc("mcp_call", { p_key: key, p_tool: "pipeline_summary", p_args: {} });
    if (error) return json({ jsonrpc: "2.0", id: batch[0]?.id ?? null, error: { code: -32001, message: error.message } }, 401);
  }
  const replies = (await Promise.all(batch.map((m) => handleRpc(m, call)))).filter(Boolean);
  if (!replies.length) return new Response(null, { status: 202, headers: CORS });
  return json(Array.isArray(body) ? replies : replies[0]);
}

// no server-sent stream: stateless server
export function GET() {
  return new Response("Dhandha MCP endpoint — POST JSON-RPC here with your Dhandha key.", { status: 405, headers: { allow: "POST", ...CORS } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
