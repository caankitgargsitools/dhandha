import { test } from "node:test";
import assert from "node:assert/strict";
import { requestText, sortInbox } from "../lib/partners.js";

test("request text", () => {
  assert.match(requestText({ tenderTitle: "Road work", from: "Garg & Co" }), /^Namaste — Garg & Co would like to bid together as a consortium \/ joint venture for "Road work"/);
  assert.match(requestText({ kind: "subcontract" }), /we would like to take up part of the work/);
});

test("inbox sorted by what needs doing", () => {
  const s = sortInbox([{ direction: "in", status: "pending" }, { direction: "out", status: "pending" }, { direction: "in", status: "accepted" }]);
  assert.equal(s.toAnswer.length, 1);
  assert.equal(s.sent.length, 1);
  assert.equal(s.settled.length, 1);
});
