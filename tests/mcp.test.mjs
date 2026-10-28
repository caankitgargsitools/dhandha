import { test } from "node:test";
import assert from "node:assert/strict";
import { handleRpc, keyFrom, TOOLS } from "../lib/mcp.js";

const KEY = "dh_" + "a1".repeat(24);

test("initialize agrees a protocol version", async () => {
  const r = await handleRpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } });
  assert.equal(r.result.protocolVersion, "2025-03-26");
  assert.equal(r.result.serverInfo.name, "dhandha");
  const r2 = await handleRpc({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } });
  assert.equal(r2.result.protocolVersion, "2025-06-18");
});

test("notifications get no reply; unknown methods an error", async () => {
  assert.equal(await handleRpc({ jsonrpc: "2.0", method: "notifications/initialized" }), null);
  assert.equal((await handleRpc({ jsonrpc: "2.0", id: 3, method: "nope" })).error.code, -32601);
  assert.equal((await handleRpc({ id: 3 })).error.code, -32600);
});

test("tools/list and tools/call", async () => {
  const list = await handleRpc({ jsonrpc: "2.0", id: 4, method: "tools/list" });
  assert.equal(list.result.tools.length, TOOLS.length);
  assert.ok(list.result.tools.every((t) => t.inputSchema.type === "object"));
  const seen = [];
  const call = async (name, args) => { seen.push([name, args]); return [{ title: "Audit" }]; };
  const r = await handleRpc({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "search_tenders", arguments: { query: "audit" } } }, call);
  assert.deepEqual(seen, [["search_tenders", { query: "audit" }]]);
  assert.equal(r.result.isError, false);
  assert.match(r.result.content[0].text, /Audit/);
  assert.deepEqual(r.result.structuredContent, { items: [{ title: "Audit" }] });
  const bad = await handleRpc({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "add_lead", arguments: {} } }, async () => { throw new Error("this key is read-only"); });
  assert.equal(bad.result.isError, true);
  assert.equal((await handleRpc({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "drop_db" } }, call)).error.code, -32602);
});

test("key from the header or the link", () => {
  assert.equal(keyFrom(`Bearer ${KEY}`, "https://x/api/mcp"), KEY);
  assert.equal(keyFrom("", `https://x/api/mcp?key=${KEY}`), KEY);
  assert.equal(keyFrom("Bearer nope", "https://x/api/mcp?key=dh_short"), null);
});
