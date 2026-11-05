import test from "node:test";
import assert from "node:assert/strict";
import { readDiff } from "../lib/readDiff.js";

test("what changed between two readings", () => {
  const d = readDiff(
    { fields: { emd_inr: 25000, due_at: "2026-11-20T12:30:00Z", req_avg_turnover: 5000000 }, formats: [{ title: "Annexure A" }], required_docs: ["REG-PAN"] },
    { fields: { emd_inr: 30000, due_at: "2026-11-27T12:30:00Z", req_avg_turnover: 5000000, bid_validity_days: null }, formats: [{ title: "Annexure A" }, { title: "Annexure F" }], required_docs: ["REG-PAN", "CERT-ISO"] });
  assert.deepEqual(d.changes.map((c) => c.key), ["due_at", "emd_inr"]);
  assert.equal(d.changes[1].to, "₹30,000");
  assert.deepEqual(d.formatsAdded, ["annexure f"]);
  assert.deepEqual(d.docsAdded, ["CERT-ISO"]);
  assert.deepEqual(d.recheck, ["price", "formats", "eligibility", "bid plan"]);
  assert.equal(readDiff({ fields: { emd_inr: 1 } }, { fields: {} }).any, false);
});
