import { test } from "node:test";
import assert from "node:assert/strict";
import { feedbackOf, muteSuggestions, bestWords } from "../lib/matchLearning.js";

const m = (w, status, extra = {}) => ({ matched_on: [w], status, ...extra });

test("what counts as taken or dropped", () => {
  assert.equal(feedbackOf({ status: "preparing" }), "took");
  assert.equal(feedbackOf({ status: "new", ai_by: "you", ai_fit: "no" }), "dropped");
  assert.equal(feedbackOf({ status: "new", ai_by: "gemini-lite", ai_fit: "no" }), null); // the AI's own guess is not the firm's choice
});

test("suggest muting words that are always dropped", () => {
  const rows = [m("energy audit", "skipped"), m("energy audit", "skipped"), m("Energy Audit", "new", { ai_by: "you", ai_fit: "no" }),
    m("internal audit", "skipped"), m("internal audit", "skipped"), m("internal audit", "skipped"), m("internal audit", "preparing"),
    m("stock audit", "skipped"), m("stock audit", "skipped"), m("stock audit", "skipped")];
  assert.deepEqual(muteSuggestions(rows).map((s) => s.word), ["energy audit", "stock audit"]);
  assert.deepEqual(muteSuggestions(rows, ["Stock Audit"]).map((s) => s.word), ["energy audit"]);
  assert.deepEqual(bestWords([m("tds", "won"), m("tds", "submitted"), m("gst", "won")]).map((s) => s.word), ["tds"]);
});
