import test from "node:test";
import assert from "node:assert/strict";
import { mapGemResultDoc, parseGemResult } from "../src/adapters/gemResults.js";

test("GeM listing doc → bid to open", () => {
  const b = mapGemResultDoc({ b_bid_number: ["GEM/2026/B/5823417"], b_id: [8123456], b_category_name: ["Road Maintenance Service"], ba_official_details_minName: ["Ministry of Road Transport"], ba_official_details_deptName: ["NHAI Haryana"] }, "https://bidplus.gem.gov.in");
  assert.equal(b.tender_ref, "GEM/2026/B/5823417");
  assert.equal(b.resultUrl, "https://bidplus.gem.gov.in/bidding/bid/getBidResultView/8123456");
  assert.equal(b.industry_pack, "construction");
  assert.equal(b.state, "Haryana");
  assert.equal(mapGemResultDoc({ b_bid_number: ["X"] }, ""), null);
});

test("financial evaluation: L1 wins", () => {
  const tables = [
    [["Technical Evaluation"], ["S.No", "Seller Name", "Status"], ["1", "A", "Qualified"]],
    [["S.No.", "Seller Name", "Item", "Total Price", "Rank"],
     ["1", "Shiv Shakti Traders (MSE)", "Bitumen", "₹ 12,40,000", "L1"],
     ["2", "Rao Supplies", "Bitumen", "₹ 12,95,000", "L2"]],
  ];
  assert.deepEqual(parseGemResult(tables), [{ bidder_name: "Shiv Shakti Traders", awarded_value: 1240000 }]);
});

test("awarded status beats rank; no rank or status means no result yet", () => {
  const t = [[["Seller Name", "Offered Price", "Rank", "Status"], ["Alpha LLP", "100", "L1", "Not Awarded"], ["Beta Pvt Ltd", "105", "L2", "Contract Awarded"]]];
  assert.deepEqual(parseGemResult(t), [{ bidder_name: "Beta Pvt Ltd", awarded_value: 105 }]);
  assert.deepEqual(parseGemResult([[["Seller Name", "Offered Price"], ["Alpha", "100"]]]), []);
});
