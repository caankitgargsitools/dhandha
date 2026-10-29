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

test("price to win from similar results", async () => {
  const { priceToWin } = await import("../lib/pastResults.js");
  const rows = [10, 8, 12, 9, 15].map((d) => ({ estimate: 100, awarded_value: 100 - d }));
  const p = priceToWin(rows, 5000000);
  assert.equal(p.known, 5);
  assert.equal(p.discount.mid, 10);
  assert.equal(p.price.likely, 4500000);
  assert.ok(p.price.safe < p.price.likely && p.price.likely < p.price.stretch);
  assert.equal(priceToWin(rows.slice(0, 2), 5000000), null);
  assert.equal(priceToWin(rows, null), null);
});

test("firm names normalised like SQL norm_firm", async () => {
  const { normFirm } = await import("../lib/pastResults.js");
  assert.equal(normFirm("M/s. Shiv Shakti Builders & Co."), "shivshaktibuilders");
  assert.equal(normFirm("ABC Infra Private Limited"), "abcinfra");
  assert.equal(normFirm("The Sharma and Sons LLP"), "sharmasons");
});
