import { test } from "node:test";
import assert from "node:assert/strict";
import { depositSummary, daysTo, refundLetter } from "../lib/deposits.js";

const today = new Date("2026-10-29T10:00:00Z");

test("summary of money with departments", () => {
  const s = depositSummary([
    { kind: "emd", status: "held", amount: 50000 },
    { kind: "bg", status: "held", amount: 200000, valid_until: "2026-11-10" },
    { kind: "emd", status: "refund_due", amount: 25000, refund_expected_on: "2026-10-01" },
    { kind: "emd", status: "refund_due", amount: 10000, refund_expected_on: "2026-12-01" },
    { kind: "fee", status: "held", amount: 1180, paid_on: "2026-09-01" },
    { kind: "emd", status: "refunded", amount: 30000, refunded_on: "2026-05-01" },
  ], today);
  assert.deepEqual(s.held, { count: 2, amount: 250000 });
  assert.deepEqual(s.due, { count: 2, amount: 35000 });
  assert.deepEqual(s.late, { count: 1, amount: 25000 });
  assert.deepEqual(s.expiring, { count: 1, amount: 200000 });
  assert.equal(s.refundedYear.amount, 30000);
  assert.equal(s.feesYear, 1180);
  assert.equal(daysTo("2026-11-10", today), 12);
});

test("refund letter", () => {
  const l = refundLetter({ company: "Garg & Co", authority: "PWD Gurugram", title: "Road work", ref: "2026_PWD_1", amount: 50000, mode: "NEFT", reference: "UTR1" });
  assert.match(l, /Refund of EMD — Road work \(Tender ID 2026_PWD_1\)/);
  assert.match(l, /₹50,000 by NEFT \(reference UTR1\)/);
});
