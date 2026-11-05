import test from "node:test";
import assert from "node:assert/strict";
import { groupDuplicates } from "../lib/dupes.js";

test("same notice on two portals is shown once", () => {
  const a = { id: "a", status: "new", score: 70, tenders: { portal: "CPPP Central e-Tenders", title: "Concurrent Audit of Branches for FY 2026-27 (Ref 12)", authority: "Punjab National Bank, Delhi", due_at: "2026-11-20T10:00:00Z" } };
  const b = { id: "b", status: "shortlisted", score: 60, tenders: { portal: "Delhi e-Procurement", title: "Concurrent audit of branches for FY 2026-27", authority: "Punjab National Bank", due_at: "2026-11-21T09:00:00Z", url: "u" } };
  const c = { id: "c", status: "new", score: 50, tenders: { portal: "Delhi e-Procurement", title: "Supply of computers", authority: "NIC", due_at: "2026-11-21T09:00:00Z" } };
  const out = groupDuplicates([a, b, c]);
  assert.deepEqual(out.map((m) => m.id), ["b", "c"]); // the shortlisted copy is kept
  assert.equal(out[0].also[0].portal, "CPPP Central e-Tenders");
});

test("same title but different closing or same portal stays separate", () => {
  const a = { id: "a", tenders: { portal: "X", title: "Annual audit of accounts", authority: "ABC", due_at: "2026-11-01T00:00:00Z" } };
  const b = { id: "b", tenders: { portal: "Y", title: "Annual audit of accounts", authority: "ABC", due_at: "2026-12-01T00:00:00Z" } };
  const c = { id: "c", tenders: { portal: "X", title: "Annual audit of accounts", authority: "ABC", due_at: "2026-11-01T00:00:00Z" } };
  assert.equal(groupDuplicates([a, b, c]).length, 3);
});
