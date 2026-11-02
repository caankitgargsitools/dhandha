import { test } from "node:test";
import assert from "node:assert/strict";
import { priceNotes, starterLines, spreadOverSor } from "../lib/priceNotes.js";

const gem = { split: { bidders: 3, ratio: [50, 30, 20] }, floor_price: true, highest_wins: true,
  wages: [{ people: 11, daily_wage: 918, bonus: 0, edli: 0, pf_admin: 9.18, esi: 29.83, pf: 110.16, allowances: 0, days: 26, months: 36 }] };
const terms = { gst: { concessional_pct: 0, reverse_charge: true }, clauses: [{ kind: "wages_yours" }], post_audit_months: 12, hardware: [{ kind: "disks_retained", label: "x" }], price_basis: "FOR destination", remote_km: 600, loading_unloading: true, price_sheet_rules: ["Quote for one year only"] };

test("price notes say what the bid does to the price", () => {
  const t = priceNotes({ gem, terms }).map((n) => n.text).join("\n");
  assert.match(t, /Highest offer wins/);
  assert.match(t, /floor price \(hidden on GeM\)/);
  assert.match(t, /coming 2nd and matching L1's price still wins 30% of the order, 3rd 20%/);
  assert.match(t, /concessional 0%/);
  assert.match(t, /Reverse charge/);
  assert.match(t, /one year only/);
  assert.match(t, /600 km/);
  assert.deepEqual(priceNotes({}), []);
});

test("the cost planner starts from the buyer's wage sheet and the bid's own cost lines", () => {
  const s = starterLines({ gem, terms });
  assert.equal(s.manpower[0].count, 11);
  assert.equal(s.months, 36);
  assert.equal(s.statutory.pf_pct, 13);
  const items = s.other.map((o) => o.item);
  assert.match(items[0], /Wage-rise buffer.*≈7\.5% over 36 months/);
  assert.ok(s.other[0].amount > 0);
  assert.ok(items.some((i) => /Post-audit support: 12 months/.test(i)));
  assert.ok(items.includes("Replacement disks kept by the buyer (expected failures × disk price)"));
  assert.ok(items.includes("Freight to site") && items.includes("Transit insurance"));
  assert.ok(items.some((i) => /Remote site \(600 km.*loading \/ unloading/.test(i)));
});

test("a lump sum spread over the schedule of rates, minimum-wage lines fixed (Q36)", () => {
  const rows = [{ item: "Minimum wages of operators", qty: 2, rate: 1000 }, { item: "Pipeline patrolling", qty: 10, rate: 100 }, { item: "Valve maintenance", qty: 5, rate: 200 }];
  const out = spreadOverSor(rows, 6000); // fixed 2,000; others 2,000 → ×2
  assert.equal(out[0].rate, 1000);
  assert.equal(out[1].rate, "200");
  assert.equal(out[2].rate, "400");
  assert.equal(spreadOverSor(rows, 1500), null);
});
