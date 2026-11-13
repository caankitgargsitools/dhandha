import test from "node:test";
import assert from "node:assert/strict";
import { searchKb, snippetOf, askPrompt, cleanAnswer, STARTERS, terms } from "../lib/knowledge.js";

const A = [
  { id: "1", kind: "policy", title: "Payment and collection policy", tags: "payment, invoice", body: "Reminder on the due date, then every 7 days. Over 60 days: hold work.", updated_at: "2026-11-01" },
  { id: "2", kind: "sop", title: "How we prepare a tender bid", tags: "tender", body: "Arrange the EMD early. Upload with the DSC one day before closing.", updated_at: "2026-11-05", pinned: true },
  { id: "3", kind: "faq", title: "Old", tags: "", body: "payment by cheque", archived_at: "2026-11-02" },
];

test("search ranks title and tag hits, skips archived, filters by kind", () => {
  const r = searchKb(A, "when do we remind for payment");
  assert.equal(r[0].a.id, "1");
  assert.ok(!r.find((x) => x.a.id === "3"));
  assert.equal(searchKb(A, "EMD")[0].a.id, "2");
  assert.equal(searchKb(A, "", {})[0].a.id, "2"); // pinned first when no query
  assert.equal(searchKb(A, "payment", { kind: "sop" }).length, 0);
  assert.deepEqual(terms("How do we prepare bids?"), ["prepare", "bid"]);
});

test("snippet, prompt and answer clean-up", () => {
  assert.match(snippetOf("x ".repeat(100) + "DSC upload here", ["dsc"]), /^…/);
  const hits = searchKb(A, "EMD");
  assert.match(askPrompt("When is the EMD due?", hits), /\[1\] How we prepare a tender bid/);
  assert.deepEqual(cleanAnswer({ answer: "Arrange it early.", used: [1, 9] }, hits), { answer: "Arrange it early.", used: [{ id: "2", title: "How we prepare a tender bid" }] });
  assert.equal(cleanAnswer({ answer: "" }, hits), null);
  assert.ok(STARTERS.length >= 5 && STARTERS.every((s) => s.title && s.body));
});
