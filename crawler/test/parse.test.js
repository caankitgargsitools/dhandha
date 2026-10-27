import test from "node:test";
import assert from "node:assert/strict";
import { parseIstDate, rupees, industryPack, stateFrom } from "../src/classify.js";
import { parseTitleCell, parseDetail } from "../src/adapters/gepnic.js";
import { mapGemDoc, parseGemText, gemDate } from "../src/adapters/gem.js";

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
  assert.equal(t.tender_ref, "GEM/2026/B/5823417"); assert.equal(t.industry_pack, "construction"); assert.equal(t.due_at, "2026-10-18T15:00:00+05:30");
  // real answer of all-bids-data (27 Oct 2026): India time marked Z, RA link, quantity
  const ra = mapGemDoc({ id: "10074964", b_id: [10074964], b_bid_number: ["GEM/2026/R/757884"], b_category_name: ["Frame,Brushless Motors"], b_total_quantity: [47], final_start_date_sort: ["2026-10-24T19:00:00Z"], final_end_date_sort: ["2026-10-27T13:09:39Z"], ba_official_details_minName: ["Ministry of Defence"], ba_official_details_deptName: ["Department of Military Affairs"] }, "https://bidplus.gem.gov.in");
  assert.equal(ra.url, "https://bidplus.gem.gov.in/showradocumentPdf/10074964");
  assert.equal(ra.title, "Frame,Brushless Motors (qty 47)");
  assert.equal(ra.authority, "Ministry of Defence / Department of Military Affairs");
  assert.equal(ra.published_on, "2026-10-24");
  const bid = mapGemDoc({ b_id: [9455923], b_bid_number: ["GEM/2026/B/7653450"], b_category_name: ["Saree"] }, "https://bidplus.gem.gov.in");
  assert.equal(bid.url, "https://bidplus.gem.gov.in/showbidDocument/9455923");
});

test("GeM bid list read from the page text", () => {
  const text = `Showing 1 - 10 records of 42206 records
Sort by: Bid End Date: Oldest First

Bid No.:  GEM/2026/B/7670847

RA NO: GEM/2026/R/757471

Items: CTG Machine (V2)
Quantity: 10
Department Name And Address: 
Ministry of Labour and Employment
Employees State Insuarnce Corporation
Start Date: 24-10-2026 1:00 PM
End Date:   26-10-2026 3:28 PM

Bid No.:  GEM/2026/B/8122503

Items: Annual audit of accounts...
Quantity: 1
Department Name And Address: 
Higher Education Department Haryana
Start Date: 25-10-2026 2:00 PM
End Date:   06-11-2026 11:00 AM
Prev`;
  const rows = parseGemText(text);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].tender_ref, "GEM/2026/B/7670847");
  assert.equal(rows[0].due_at, "2026-10-26T15:28:00+05:30");
  assert.equal(rows[0].authority, "Ministry of Labour and Employment / Employees State Insuarnce Corporation");
  assert.equal(rows[1].title, "Annual audit of accounts (qty 1)");
  assert.equal(rows[1].state, "Haryana");
  assert.equal(gemDate("06-11-2026 12:05 AM"), "2026-11-06T00:05:00+05:30");
  assert.equal(rows[0].url, "https://bidplus.gem.gov.in/all-bids");
  const linked = parseGemText(text, undefined, { "GEM/2026/B/7670847": "https://bidplus.gem.gov.in/showbidDocument/9455923" });
  assert.equal(linked[0].url, "https://bidplus.gem.gov.in/showbidDocument/9455923");
});
