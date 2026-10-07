import test from "node:test";
import assert from "node:assert/strict";
import { parseIstDate, rupees, industryPack, stateFrom } from "../src/classify.js";
import { parseTitleCell, parseDetail } from "../src/adapters/gepnic.js";
import { mapGemDoc } from "../src/adapters/gem.js";

test("IST dates", () => {
  assert.equal(parseIstDate("07-Oct-2026 05:00 PM"), "2026-10-07T11:30:00.000Z");
  assert.equal(parseIstDate("01-Nov-2026 12:30 AM"), "2026-10-31T19:00:00.000Z");
  assert.equal(parseIstDate("NA"), null);
});
test("rupees", () => {
  assert.equal(rupees("2,14,50,000.00"), 21450000);
  assert.equal(rupees("₹ 4,290"), 4290);
  assert.equal(rupees("NA"), null);
  assert.equal(rupees("0.00"), 0);
});
test("title cell", () => {
  const r = parseTitleCell("[Widening of Pataudi Rewari road] [EE/PWD/GGN/12/2026-27][2026_HRY_412871_1]");
  assert.deepEqual(r, { title: "Widening of Pataudi Rewari road", ref: "EE/PWD/GGN/12/2026-27", tenderId: "2026_HRY_412871_1" });
});
test("detail table", () => {
  const d = parseDetail([["Tender Value in ₹", "2,14,50,000", "Product Category", "Civil Works"], ["EMD Amount in ₹", "4,29,000", "Tender Fee in ₹", "5,000"], ["Bid Submission End Date", "26-Oct-2026 03:00 PM", "Bid Opening Date", "27-Oct-2026 03:30 PM"]]);
  assert.equal(d.value_inr, 21450000); assert.equal(d.emd_inr, 429000); assert.equal(d.fee_inr, 5000);
  assert.equal(d.due_at, "2026-10-26T09:30:00.000Z"); assert.equal(d.category, "Civil Works");
});
test("classify", () => {
  assert.equal(industryPack("Construction of storm water drains"), "construction");
  assert.equal(industryPack("Concurrent audit of branches"), "ca_audit");
  assert.equal(industryPack("Supply of bituminous emulsion"), "goods_supply");
  assert.equal(stateFrom("Public Works Department||Haryana Circle"), "Haryana");
});
test("GeM doc", () => {
  const t = mapGemDoc({ b_bid_number: ["GEM/2026/B/5823417"], b_category_name: ["Road Maintenance Service"], ba_official_details_minName: ["Ministry of Road Transport"], final_end_date_sort: ["2026-10-18T15:00:00Z"] }, "https://bidplus.gem.gov.in");
  assert.equal(t.tender_ref, "GEM/2026/B/5823417"); assert.equal(t.industry_pack, "construction"); assert.equal(t.due_at, "2026-10-18T15:00:00Z");
});
