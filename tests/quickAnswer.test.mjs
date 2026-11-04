import test from "node:test";
import assert from "node:assert/strict";
import { quickAnswer } from "../lib/quickAnswer.js";

const t = { emd_inr: 25000, due_at: "2026-11-20T12:30:00Z", value_inr: 1500000 };
const f = { bid_validity_days: 90, performance_security_pct: 5, mse_emd_exempt: true, tender_fee_inr: 0, prebid_on: "2026-11-10T06:00:00Z" };

test("short questions about known numbers are answered free", () => {
  assert.match(quickAnswer("What is the EMD?", t, f).answer, /₹25,000.*MSEs/);
  assert.match(quickAnswer("closing date?", t, f).answer, /20 Nov 2026/);
  assert.match(quickAnswer("bid validity kitni hai", t, f).answer, /90 days/);
  assert.match(quickAnswer("performance security?", t, f).answer, /5%/);
  assert.match(quickAnswer("Tender fee?", t, f).answer, /no tender fee/);
  assert.equal(quickAnswer("Are MSMEs exempt from EMD?", t, f).topic, "mse");
});

test("other questions go to the assistant", () => {
  assert.equal(quickAnswer("Why is the EMD so high compared to similar tenders?", t, f), null);
  assert.equal(quickAnswer("Should we bid for this?", t, f), null);
  assert.equal(quickAnswer("What is the scope of work?", t, f), null);
  assert.equal(quickAnswer("What is the opening date?", t, {}), null); // not known → assistant
});
