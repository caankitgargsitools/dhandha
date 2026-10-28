import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFilters, applyFilters, activeCount, facets } from "../lib/tenderFilters.js";

const NOW = new Date("2026-10-24T06:00:00Z").getTime();
const d = (days) => new Date(NOW + days * 86400000).toISOString();
const rows = [
  { id: 1, score: 90, eligible: true, pending: false, status: "new", tenders: { title: "GST audit of PSU", portal: "CPPP", state: "Delhi", category: "Services", industry_pack: "ca_audit", value_inr: 500000, due_at: d(2), created_at: d(-5) } },
  { id: 2, score: 60, eligible: true, pending: true, status: "shortlisted", tenders: { title: "Road repair", portal: "Haryana", state: "Haryana", category: "Works", industry_pack: "construction", value_inr: 25000000, due_at: d(20), created_at: d(-1) } },
  { id: 3, score: 75, eligible: false, unmet: true, status: "new", tenders: { title: "Laptops supply", portal: "GeM", state: "Delhi", category: "Goods", industry_pack: "goods_supply", value_inr: null, due_at: d(-3), created_at: d(-10) } },
];
const ids = (sp, now = NOW) => applyFilters(rows, parseFilters(sp), now).map((m) => m.id);

test("defaults: best match first, nothing filtered", () => {
  assert.deepEqual(ids({}), [1, 3, 2]);
  assert.equal(activeCount(parseFilters({})), 0);
});
test("time left, closed, stage and work type", () => {
  assert.deepEqual(ids({ left: "3" }), [1]);
  assert.deepEqual(ids({ left: "30" }), [1, 2]);
  assert.deepEqual(ids({ left: "closed" }), [3]);
  assert.deepEqual(ids({ stage: "new,shortlisted", work: "construction" }), [2]);
});
test("value range in lakh; tenders without a value pass a max only", () => {
  assert.deepEqual(ids({ vmin: "10" }), [2]);
  assert.deepEqual(ids({ vmax: "10" }), [1, 3]);
});
test("search, portal, state, eligibility and sorting", () => {
  assert.deepEqual(ids({ q: "road" }), [2]);
  assert.deepEqual(ids({ state: "delhi", sort: "new" }), [1, 3]);
  assert.deepEqual(ids({ elig: "pending" }), [2]);
  assert.deepEqual(ids({ elig: "eligible" }), [1]);
  assert.deepEqual(ids({ sort: "due" }), [1, 2, 3]); // closed ones last
  assert.deepEqual(ids({ sort: "value" }), [2, 1, 3]);
  assert.equal(activeCount(parseFilters({ q: "x", stage: "new", bogus: "1", left: "nope" })), 2);
  assert.deepEqual(facets(rows).portals, ["CPPP", "GeM", "Haryana"]);
});

test("kind of notice: empanelments, rate contracts, EOI", async () => {
  const { kindOf, applyFilters, parseFilters } = await import("../lib/tenderFilters.js");
  assert.deepEqual(kindOf("Empanelment of Chartered Accountant firms for concurrent audit"), ["empanelment"]);
  assert.deepEqual(kindOf("Panel of CA firms for stock audit 2026-27"), ["empanelment"]);
  assert.deepEqual(kindOf("Annual rate contract for stationery"), ["rate_contract"]);
  assert.deepEqual(kindOf("Expression of Interest for financial consultant"), ["eoi"]);
  assert.deepEqual(kindOf("Construction of boundary wall"), []);
  const rows = [{ score: 1, tenders: { title: "Empanelment of CA firms" } }, { score: 2, tenders: { title: "Road repair" } }];
  assert.equal(applyFilters(rows, parseFilters({ kind: "empanelment" })).length, 1);
});
