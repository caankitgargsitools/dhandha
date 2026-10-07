import test from "node:test";
import assert from "node:assert/strict";
import { readTenderText } from "../lib/tenderRules.js";

const pages = [
  "Estimated cost: Rs. 864.00 lakhs\nEarnest Money Deposit: Rs. 17,28,000/-\nPre-bid meeting: 16-10-2026 at 11:00 AM\nBid submission end date: 21-Oct-2026 03:00 PM\nMicro and Small Enterprises registered with NSIC / Udyam are exempted from payment of EMD.",
  "Average annual financial turnover during the last three financial years should be at least 30% of the estimated cost.\nThree similar completed works each costing not less than 40% of the estimated cost; or\nTwo similar completed works each costing not less than 50% of the estimated cost; or\nOne similar completed work costing not less than 80% of the estimated cost.\nsimilar works during the last 7 years",
  "Annexure A - Bidder information form\nForm of Bid\nLiquidated damages at 1.5% per month subject to maximum of 10%.",
];

test("reads NIT facts", () => {
  const r = readTenderText(pages);
  assert.equal(r.fields.value_inr, 86400000);
  assert.equal(r.fields.emd_inr, 1728000);
  assert.equal(r.fields.mse_emd_exempt, true);
  assert.equal(r.fields.req_avg_turnover, 25920000);
  assert.equal(r.fields.req_similar_one, 69120000);
  assert.equal(r.fields.req_similar_two, 43200000);
  assert.equal(r.fields.req_similar_three, 34560000);
  assert.equal(r.fields.req_similar_years, 7);
  assert.equal(r.fields.prebid_on, "2026-10-16");
  assert.equal(r.fields.due_at, "2026-10-21T09:30:00.000Z");
  assert.deepEqual(r.formats.map((f) => f.title), ["Annexure A - Bidder information form", "Form of Bid"]);
  assert.equal(r.risks[0].label, "Liquidated damages");
  assert.equal(r.confidence, 100);
});
