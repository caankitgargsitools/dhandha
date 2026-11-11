import test from "node:test";
import assert from "node:assert/strict";
import { nodeCards, agentRows, drift, driftAlerts, flowStages, needsList, connectionRows } from "../lib/companyMap.js";

const map = {
  nodes: { tenders: { open: 95, in_hand: 3, closing48: 1, new24: 2, prechecked24: 1 }, leads: { open: 705, new24: 47, cost24: 94, followups_overdue: 0 },
    pipeline: { open: 703, open_value: 3560000, won_month: 0, stale: 412 }, vault: { docs: 17, expired: 3, expiring30: 1 } },
  series: { leads: [50, 49, 47, 48, 51, 50, 49, 47], matches: [2, 3, 2, 2, 3, 1, 2, 20] },
};

test("node cards", () => {
  const c = nodeCards(map);
  assert.equal(c.length, 9);
  const by = Object.fromEntries(c.map((x) => [x.key, x]));
  assert.equal(by.tenders.tone, "bad");
  assert.match(by.tenders.alert, /1 closing/);
  assert.equal(by.pipeline.big, "₹35.6 L");
  assert.equal(by.vault.tone, "bad");
  assert.ok(by.leads.learn.length > 20);
});

test("drift flags jumps (any time) and drops (late in the day only)", () => {
  assert.equal(drift([50, 49, 47, 48, 51, 50, 49, 47]), null);
  assert.equal(drift([2, 3, 2, 2, 3, 1, 2, 20]).dir, "up");
  assert.equal(drift([1, 0, 1, 2, 0, 1, 1, 3]), null); // too small
  assert.equal(driftAlerts(map.series).length, 1);
});

test("agents, flow, needs, connections", () => {
  const a = agentRows([{ key: "autopilot", on: true, last: new Date(Date.now() - 2 * 3600e3).toISOString(), did: 18, unit: "leads found" }, { key: "precheck", on: true, failed: 3 }]);
  assert.equal(a[0].ago, "2 h ago");
  assert.equal(a[1].state, "warn");
  const f = flowStages({ tenders: { found: 95, preparing: 3, stuck_preparing: 1 }, deals: { new: 694, won: 2 }, paid: { outstanding: 1 } });
  assert.equal(f.tenders.length, 7);
  assert.equal(f.tenders[2].stuck, 1);
  assert.equal(f.sales.find((x) => x.key === "won").n, 2);
  const n = needsList({ closing: [{ id: "m", title: "Audit", due: new Date().toISOString() }], followups: 3, resets: 1 }, "manager");
  assert.equal(n.length, 2);
  assert.equal(n[0].tone, "bad");
  const c = connectionRows({ crawler: new Date().toISOString(), sessions_live: 28, maps: { ok: true } }, { ai: true });
  assert.equal(c.find((x) => x.key === "crawler").state, "on");
  assert.equal(c.find((x) => x.key === "whatsapp").state, "off");
});
