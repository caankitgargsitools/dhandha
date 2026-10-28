import { test } from "node:test";
import assert from "node:assert/strict";
import { discountPct, summarise, adviceLine } from "../lib/pastResults.js";

test("discount against the estimate", () => {
  assert.equal(discountPct(90, 100), 10);
  assert.equal(discountPct(105, 100), -5);
  assert.equal(discountPct(90, null), null);
  assert.equal(discountPct(0, 100), null);
});

test("summary: range, middle, discount, repeat winners", () => {
  const rows = [
    { bidder_name: "Sharma & Co", awarded_value: 800000, estimate: 1000000 },
    { bidder_name: "sharma & co ", awarded_value: 600000 },
    { bidder_name: "Gupta Associates", awarded_value: 1200000, estimate: 1250000 },
    { bidder_name: null, awarded_value: null },
  ];
  const s = summarise(rows);
  assert.equal(s.count, 4);
  assert.equal(s.min, 600000);
  assert.equal(s.max, 1200000);
  assert.equal(s.median, 800000);
  assert.deepEqual(s.discount, { median: 12, known: 2 });
  assert.equal(s.winners[0].name, "Sharma & Co");
  assert.equal(s.winners[0].wins, 2);
  assert.match(adviceLine(s), /4 similar contracts.*12% below the estimate/);
});

test("nothing found says nothing", () => {
  assert.equal(adviceLine(summarise([])), null);
  assert.equal(summarise([]).median, null);
});
