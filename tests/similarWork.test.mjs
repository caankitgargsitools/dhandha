import test from "node:test";
import assert from "node:assert/strict";
import { similarWorks, workFit } from "../lib/similarWork.js";

const works = [
  { work_name: "Statutory audit of branches", client: "Punjab National Bank", value_inr: 900000, end_date: "2025-03-31", status: "completed", scope: "bank branch audit" },
  { work_name: "Internal audit", client: "Delhi Jal Board", value_inr: 2400000, end_date: "2024-06-30", status: "completed" },
  { work_name: "GST registration", client: "ABC Traders", value_inr: 20000, end_date: "2025-01-10", status: "completed" },
  { work_name: "Concurrent audit", client: "SBI", value_inr: 5000000, end_date: "2012-01-01", status: "completed" },
];

test("ranks works against the definition and checks the value tests", () => {
  const r = similarWorks({ similar_work_definition: "Statutory / internal audit of banks or PSUs", req_similar_one: 2000000, req_similar_two: 1200000, req_similar_three: 800000 }, works, new Date("2026-11-04"));
  assert.equal(r.best[0].work.work_name, "Statutory audit of branches");
  assert.ok(!r.best.some((x) => x.work.work_name === "Concurrent audit")); // older than 7 years
  assert.equal(r.tests.length, 3);
  assert.equal(r.tests[0].ok, true); // one ≥ 20 lakh: internal audit
  assert.equal(r.ok, true);
});

test("says what is missing when no test is met", () => {
  const r = similarWorks({ similar_work_definition: "audit", req_similar_one: 9000000 }, works, new Date("2026-11-04"));
  assert.equal(r.ok, false);
  assert.match(r.gap, /closest/);
  assert.ok(workFit("bank audit", works[0]) > 0.5);
});
