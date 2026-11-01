import { test } from "node:test";
import assert from "node:assert/strict";
import { findFinTests, checkFinTests } from "../lib/finTests.js";

// Wording as it appears in railway / PSU NITs (shortened)
const nit = `2.1 Financial Capability: The aggregate turnover of the bidder during the last three financial years and the current
year should be at least 1.5 times the advertised value of the tender. 2.2 The bidder shall submit a certificate of
liquid assets / access to lines of credit from a scheduled bank for not less than 5% of the advertised value, dated within three months of the bid closing date.
2.3 The bidder should have positive net worth in each of the last three financial years. 2.4 The bidder should have made
net profit in each of the last three financial years.`;

test("reads the money tests a railway / PSU NIT asks", () => {
  const f = findFinTests(nit);
  assert.equal(f.aggregate.times, 1.5);
  assert.equal(f.aggregate.years, 3);
  assert.equal(f.liquid.pct, 5);
  assert.equal(f.liquid.letter_months, 3);
  assert.equal(f.net_worth.positive, true);
  assert.equal(f.net_worth.years, 3);
  assert.equal(f.profit.years, 3);
  assert.equal(findFinTests("Average annual turnover of Rs 10 lakh"), null);
  const g = findFinTests("Cumulative turnover of Rs. 2.5 crore in the best three out of last five financial years. Net worth should not be less than Rs 50 lakh. The firm should not have incurred any loss in the last two years.");
  assert.equal(g.aggregate.amount, 25000000);
  assert.deepEqual([g.best_of.take, g.best_of.of], [3, 5]);
  assert.equal(g.net_worth.amount, 5000000);
  assert.equal(g.profit.years, 2);
});

test("checks them against the Vault's yearly figures", () => {
  const facts = [
    ...[["FY 2024-25", 9e6], ["FY 2023-24", 7e6], ["FY 2022-23", 5e6]].map(([period, value]) => ({ key: "fin.turnover", period, value: String(value) })),
    { key: "fin.net_worth", period: "FY 2024-25", value: "2000000" }, { key: "fin.net_worth", period: "FY 2023-24", value: "-100000" },
    { key: "fin.profit_after_tax", period: "FY 2024-25", value: "500000" }, { key: "fin.profit_after_tax", period: "FY 2023-24", value: "300000" }, { key: "fin.profit_after_tax", period: "FY 2022-23", value: "100000" },
  ];
  const rows = Object.fromEntries(checkFinTests(findFinTests(nit), facts, 1e7).map((r) => [r.key, r]));
  assert.equal(rows.aggregate.state, "ok"); // 2.1 Cr ≥ 1.5 Cr
  assert.equal(rows.liquid.state, "ask");
  assert.match(rows.liquid.need, /5.00 lakh/);
  assert.equal(rows.net_worth.state, "bad");
  assert.equal(rows.profit.state, "ok");
  const short = Object.fromEntries(checkFinTests(findFinTests(nit), facts, 2e7).map((r) => [r.key, r]));
  assert.equal(short.aggregate.state, "bad");
  assert.match(short.aggregate.note, /Short by ₹90.00 lakh/);
  assert.equal(checkFinTests(findFinTests(nit), [], 1e7).find((r) => r.key === "profit").state, "ask");
});

test("real PDF text with broken words (from the study)", () => {
  const a = findFinTests("aggregate financial turnover not less than 1.5 time s the advertised Bid value during the last three previous financial years and in the current financial year");
  assert.equal(a.aggregate.times, 1.5);
  assert.equal(findFinTests("Aggregate financial turnover not less than 1.5 tim es the advertised Bid value").aggregate.times, 1.5);
  const b = findFinTests("liquid assets, lines of credit and other financial means to meet cash flow that is valued at 5% of the estimated bid value. A certificate certifying the Ne t Worth (+ve) for each of the last three financial years");
  assert.equal(b.liquid.pct, 5);
  assert.equal(b.net_worth.positive, true);
  assert.equal(b.net_worth.years, 3);
});
