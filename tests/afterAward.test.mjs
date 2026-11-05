import test from "node:test";
import assert from "node:assert/strict";
import { performanceSecurity, awardTasks, experienceFromWin, completionLetter } from "../lib/afterAward.js";

test("performance security from % and LoA date", () => {
  assert.deepEqual(performanceSecurity({ pct: 5, value: 1000000, loaDate: "2026-11-05" }), { pct: 5, amount: 50000, due: "2026-11-26", months: null });
  assert.equal(performanceSecurity({ epbgPct: 3, value: 200000 }).amount, 6000);
  assert.equal(performanceSecurity({ value: 100 }), null);
});

test("award tasks and experience entry", () => {
  const ps = performanceSecurity({ pct: 5, value: 1000000, loaDate: "2026-11-05" });
  const t = awardTasks({ title: "Statutory audit 2026-27", loaDate: "2026-11-05", ps });
  assert.deepEqual(t.map((x) => x.key), ["ps", "agreement", "kickoff"]);
  assert.equal(t[1].due, "2026-12-05");
  const e = experienceFromWin({ tender: { title: "Audit", authority: "PNB" }, match: { contract_value: 900000, loa_no: "LOA/1", loa_date: "2026-11-05", completed_on: "2027-03-31" } });
  assert.equal(e.value_inr, 900000);
  assert.equal(e.work_order_no, "LOA/1");
  assert.equal(e.end_date, "2027-03-31");
  assert.match(completionLetter({ company: { legal_name: "ABC & Co" }, tender: { title: "Audit", authority: "PNB" }, match: { loa_no: "LOA/1" } }), /LoA No\. LOA\/1[\s\S]*ABC & Co/);
});
