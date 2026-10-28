import { test } from "node:test";
import assert from "node:assert/strict";
import { computeQuote, sameState, normaliseLines } from "../lib/quote.js";

test("intra-state: CGST + SGST; inter-state: IGST", () => {
  const lines = [{ desc: "GST return filing (12 months)", qty: 12, rate: 2500, gst: 18 }, { desc: "Books of account", qty: 1, rate: 10000, gst: 18 }];
  const a = computeQuote(lines, { seller: { gstin: "06AAAPG1234A1Z5" }, buyer: { gstin: "06BBBPG1234A1Z5" } });
  assert.equal(a.subtotal, 40000); assert.equal(a.local, true);
  assert.equal(a.cgst, 3600); assert.equal(a.sgst, 3600); assert.equal(a.igst, 0); assert.equal(a.total, 47200);
  assert.match(a.words, /Forty Seven Thousand Two Hundred/);
  const b = computeQuote(lines, { seller: { gstin: "06AAAPG1234A1Z5" }, buyer: { state: "Maharashtra" } });
  assert.equal(b.local, false); assert.equal(b.igst, 7200); assert.equal(b.total, 47200);
});

test("discount before tax, mixed rates, rounding", () => {
  const q = computeQuote([{ desc: "Audit", qty: 1, rate: 50000, gst: 18 }, { desc: "Printed report", qty: 3, rate: 333.33, gst: 12 }], { discount: 5000, seller: { state: "Haryana" }, buyer: { state: "Haryana" } });
  assert.equal(q.subtotal, 50999.99);
  assert.equal(q.discount, 5000); assert.equal(q.taxable, 45999.99);
  assert.equal(q.taxes.length, 2);
  assert.equal(Number.isInteger(q.total), true);
  assert.ok(Math.abs(q.round_off) < 1);
});

test("lines and states are cleaned", () => {
  assert.deepEqual(normaliseLines([{ desc: " ", qty: 1, rate: 1 }, { desc: "X", qty: 0, rate: 5 }, { desc: "Y", qty: 2, rate: 5, gst: 7 }]).map((l) => [l.desc, l.gst]), [["Y", 18]]);
  assert.equal(sameState({ state: "Uttar Pradesh" }, { state: "uttar pradesh" }), true);
  assert.equal(sameState({ state: "Delhi" }, {}), true);
});
