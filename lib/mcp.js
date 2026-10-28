// Dhandha's AI-assistant plug-in (MCP, "Streamable HTTP", stateless JSON replies): Claude, ChatGPT, Gemini or any MCP
// client connects to /api/mcp with a workspace key (Settings → AI assistants) and can search the workspace's tenders,
// read one, look up past results and leads, see the pipeline and (with a write key) add a lead. Every tool runs in SQL
// (mcp_call) against the key's own company. handleRpc is pure apart from the `call(tool, args)` it is given (tested).

export const VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const str = (description) => ({ type: "string", description });
const int = (description) => ({ type: "integer", description, minimum: 1, maximum: 50 });

export const TOOLS = [
  { name: "search_tenders", title: "Search my tenders",
    description: "Open government tenders that match this business in Dhandha, best score first. Each has a match_id for get_tender.",
    inputSchema: { type: "object", properties: { query: str("Words in the title, department or state"), status: { type: "string", enum: ["new", "shortlisted", "preparing", "submitted", "won", "lost", "skipped"] }, include_closed: { type: "boolean" }, limit: int("How many (default 20)") } } },
  { name: "get_tender", title: "Read one tender",
    description: "Everything Dhandha knows about one matched tender: dates, value, EMD, eligibility and why it fits, what the documents say, things to prepare, corrigenda.",
    inputSchema: { type: "object", properties: { match_id: str("match_id from search_tenders") }, required: ["match_id"] } },
  { name: "past_results", title: "Past tender results",
    description: "Award-of-contract results from public portals: who won similar work and at what value (and the estimate when published).",
    inputSchema: { type: "object", properties: { query: str("Work, department or winning firm"), state: str("Indian state, e.g. Haryana"), limit: int("How many (default 20)") } } },
  { name: "search_leads", title: "Search my leads",
    description: "Leads in this business's Dhandha CRM with contact details, status, score and deal stage.",
    inputSchema: { type: "object", properties: { query: str("Name, person, city, email or phone"), status: { type: "string", enum: ["new", "contacted", "interested", "not_interested", "converted", "junk"] }, limit: int("How many (default 20)") } } },
  { name: "pipeline_summary", title: "Pipeline summary",
    description: "Deals by stage with values, follow-ups due today, open matching tenders and the credit balance.",
    inputSchema: { type: "object", properties: {} } },
  { name: "add_lead", title: "Add a lead",
    description: "Add a new lead to the Dhandha CRM (needs a phone or an email). Duplicates are skipped. Only works with a key that may add leads.",
    inputSchema: { type: "object", properties: { name: str("Business or person name"), contact_person: str("Contact person"), phone: str("Phone"), email: str("Email"), city: str("City"), state: str("State"), industry: str("Industry"), website: str("Website"), note: str("Note for the timeline") }, required: ["name"] },
    annotations: { readOnlyHint: false, destructiveHint: false } },
];
for (const t of TOOLS) if (!t.annotations) t.annotations = { readOnlyHint: true };

const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const fail = (id, code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

// one JSON-RPC message → a reply (null for notifications)
export async function handleRpc(msg, call) {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return fail(msg?.id, -32600, "Invalid request");
  const { id, method, params = {} } = msg;
  if (id === undefined) return null; // notifications (initialized, cancelled …) need no reply
  if (method === "initialize") {
    const v = VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : VERSIONS[0];
    return ok(id, { protocolVersion: v, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "dhandha", title: "Dhandha", version: "1.0.0" },
      instructions: "Dhandha is this business's tender and sales workspace (India). Use search_tenders / get_tender for government tenders, past_results for who won what, search_leads / pipeline_summary for the CRM. Amounts are in Indian rupees; times are UTC." });
  }
  if (method === "ping") return ok(id, {});
  if (method === "tools/list") return ok(id, { tools: TOOLS });
  if (method === "tools/call") {
    const tool = TOOLS.find((t) => t.name === params.name);
    if (!tool) return fail(id, -32602, `Unknown tool: ${params.name}`);
    try {
      const data = await call(tool.name, params.arguments || {});
      return ok(id, { content: [{ type: "text", text: JSON.stringify(data, null, 1) }], structuredContent: Array.isArray(data) ? { items: data } : data ?? {}, isError: false });
    } catch (e) {
      return ok(id, { content: [{ type: "text", text: String(e?.message || e) }], isError: true });
    }
  }
  if (method === "resources/list") return ok(id, { resources: [] });
  if (method === "prompts/list") return ok(id, { prompts: [] });
  return fail(id, -32601, `Method not found: ${method}`);
}

// a key from "Authorization: Bearer dh_…" or ?key=dh_… (for assistants that only take a URL)
export function keyFrom(authorization, url) {
  const m = /^Bearer\s+(dh_[0-9a-f]{48})$/i.exec(authorization || "");
  if (m) return m[1];
  try { const k = new URL(url).searchParams.get("key"); return /^dh_[0-9a-f]{48}$/.test(k || "") ? k : null; } catch { return null; }
}
