import test from "node:test";
import assert from "node:assert/strict";
import { swapRefs, cloneFormats, likeness } from "../lib/cloneBid.js";

const from = { tender_ref: "2026_PNB_111_1", title: "Concurrent audit of branches 2026", authority: "Punjab National Bank" };
const to = { tender_ref: "2026_BOB_222_1", title: "Concurrent audit of branches 2027", authority: "Bank of Baroda" };

test("swaps the old tender's references", () => {
  assert.equal(swapRefs("Ref 2026_PNB_111_1 for Punjab National Bank", from, to), "Ref 2026_BOB_222_1 for Bank of Baroda");
});

test("clones formats without the old tender's own bits", () => {
  const plan = cloneFormats([{ title: "Annexure A", kind: "custom", edited_text: "To Punjab National Bank", reviewed: true, gdoc: { id: 1 } }, { title: "x", kind: "skip" }], from, to);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].edited_text, "To Bank of Baroda");
  assert.equal(plan[0].reviewed, undefined);
  assert.equal(plan[0].gdoc, undefined);
  assert.equal(plan[0].cloned, true);
});

test("likeness ranks similar tenders", () => {
  assert.ok(likeness(from, to) > likeness(from, { title: "Supply of computers", authority: "NIC" }));
});
