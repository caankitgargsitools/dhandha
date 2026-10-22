import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSheet, manpowerCost, travelCost, emptySheet, cleanSheet, monthsFrom } from "../lib/costing.js";

test("manpower carries PF, ESI under the limit, bonus", () => {
  // 20,000 wage: 13 + 3.25 + 8.33 = 24.58% on top
  assert.deepEqual(manpowerCost({ count: 2, monthly_wage: 20000 }, undefined, 12), { perMonth: 24916, total: 597984 });
  // above the ESI limit: no ESI
  assert.equal(manpowerCost({ count: 1, monthly_wage: 30000, months: 1 }).perMonth, 36399);
});

test("travel: trips x persons x (fare + days x (per diem + stay))", () => {
  assert.equal(travelCost({ trips: 4, persons: 2, fare: 3000, days: 2, per_diem: 1000, stay: 2500 }), 4 * 2 * (3000 + 2 * 3500));
});

test("whole sheet: overheads, contingency, margin, GST, vs estimate", () => {
  const s = { ...emptySheet({ months: 12, value: 1000000 }), boq: [{ qty: 10, rate: 50000 }], other: [{ amount: 100000 }] };
  const c = computeSheet(s);
  assert.equal(c.direct, 600000);
  assert.equal(c.cost, 678000);
  assert.equal(c.quote, Math.round(678000 * 1.1));
  assert.equal(c.withGst, Math.round(745800 * 1.18));
  assert.equal(c.vsEstimatePct, -25.42);
});

test("clean sheet keeps shape, caps percentages", () => {
  const s = cleanSheet({ boq: [{ item: "x", qty: "2", rate: "5", junk: 1 }], margin_pct: 500, months: 0 });
  assert.deepEqual(s.boq, [{ item: "x", unit: "", qty: "2", rate: "5" }]);
  assert.equal(s.margin_pct, 100);
  assert.equal(s.months, 12);
});

test("period to months", () => {
  assert.equal(monthsFrom("180"), 6);
  assert.equal(monthsFrom("2 years"), 24);
  assert.equal(monthsFrom("9 months"), 9);
  assert.equal(monthsFrom(null), 12);
});
