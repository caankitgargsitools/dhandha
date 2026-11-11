import test from "node:test";
import assert from "node:assert/strict";
import { customerScore, healthSummary } from "../lib/customerScore.js";

const now = new Date("2026-11-11T10:00:00Z");
const ago = (d) => new Date(now - d * 86400000).toISOString();

test("a loyal, paying, referring customer is healthy", () => {
  const h = customerScore({ last_won: ago(20), won_deals: 3, won_value: 1500000, last_touch: ago(5), referrals: 1, review_clicked: true }, now);
  assert.equal(h.band, "healthy");
  assert.ok(h.score >= 90, String(h.score));
  assert.equal(h.flags.length, 0);
});

test("overdue and silent → at risk, chase payment first", () => {
  const h = customerScore({ last_won: ago(300), won_deals: 1, won_value: 50000, last_touch: ago(100), overdue: 30000, overdue_count: 2 }, now);
  assert.equal(h.band, "at_risk");
  assert.equal(h.next, "Chase the overdue payment");
  assert.ok(h.flags.some((f) => /overdue/.test(f)) && h.flags.some((f) => /No contact/.test(f)));
});

test("renewal soon and never contacted", () => {
  const h = customerScore({ last_won: ago(330), won_deals: 1, won_value: 200000, renews_on: new Date(now.getTime() + 20 * 86400000).toISOString().slice(0, 10) }, now);
  assert.ok(h.flags.includes("Never contacted after the win"));
  assert.ok(h.flags.some((f) => /Renews in 20 days/.test(f)));
  assert.equal(h.next, "Talk about the renewal");
});

test("summary", () => {
  const rows = [{ won_value: 100, h: { band: "at_risk", score: 20 } }, { won_value: 5, h: { band: "healthy", score: 80 } }];
  assert.deepEqual(healthSummary(rows), { healthy: 1, watch: 0, at_risk: 1, total: 2, riskValue: 100, avg: 50 });
});
