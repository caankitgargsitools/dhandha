import test from "node:test";
import assert from "node:assert/strict";
import { quote, planQuote, rupeesInWords } from "../lib/billing.js";

const MODULES = [
  { code: "platform", monthly_fee_inr: 499, included_credits: 100 },
  { code: "tenders", monthly_fee_inr: 999, included_credits: 300 },
  { code: "leads", monthly_fee_inr: 499, included_credits: 300 },
];

test("GST quote matches SQL rounding", () => {
  assert.deepEqual(quote(1000), { base: 1000, gst: 180, total: 1180 });
  assert.deepEqual(quote(1997), { base: 1997, gst: 359.46, total: 2356.46 });
});

test("plan always includes platform", () => {
  const q = planQuote(MODULES, ["tenders", "leads"]);
  assert.equal(q.base, 1997); assert.equal(q.credits, 700); assert.deepEqual(q.modules, ["platform", "tenders", "leads"]);
  assert.equal(planQuote(MODULES, []).base, 499);
  assert.equal(planQuote(MODULES, [], { suite: true }).total, 2948.82);
});

test("amount in words, Indian system", () => {
  assert.equal(rupeesInWords(2356.46), "Rupees Two Thousand Three Hundred Fifty Six and Forty Six Paise Only");
  assert.equal(rupeesInWords(1180), "Rupees One Thousand One Hundred Eighty Only");
  assert.equal(rupeesInWords(235646.5), "Rupees Two Lakh Thirty Five Thousand Six Hundred Forty Six and Fifty Paise Only");
  assert.equal(rupeesInWords(123456789), "Rupees Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine Only");
  assert.equal(rupeesInWords(0), "Rupees Zero Only");
});
