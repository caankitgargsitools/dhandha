import test from "node:test";
import assert from "node:assert/strict";
import { readiness, timeLeft } from "../lib/readiness.js";

test("readiness counts the five steps", () => {
  const r = readiness({
    match: { quoted_price: 500000, filled_formats: [{ kind: "covering_letter", filled_text: "We offer…" }, { kind: "custom", edited_text: "Name: ABC", reviewed: true }] },
    readEngines: ["precheck", "rules"],
    signoffs: [{ step: "technical", decision: "approved", created_at: "1" }, { step: "finance", decision: "changes", created_at: "1" }, { step: "finance", decision: "approved", created_at: "2" }],
    packs: [{ kind: "draft" }],
  });
  assert.deepEqual(r.steps.map((s) => s.done), [true, true, true, false, false]);
  assert.equal(r.pct, 60);
  assert.equal(r.next, "Sign-offs");
});

test("blank formats and a pre-check only are not ready", () => {
  const r = readiness({ match: { filled_formats: [{ kind: "custom", filled_text: "Name [TO BE FILLED: name]" }] }, readEngines: ["precheck"] });
  assert.equal(r.steps[0].done, false);
  assert.equal(r.steps[1].done, false);
});

test("timeLeft", () => {
  const now = new Date("2026-11-05T00:00:00Z");
  assert.deepEqual(timeLeft("2026-11-06T04:30:00Z", now), { text: "1 d 4 h", tone: "bad", hours: 28.5 });
  assert.equal(timeLeft("2026-11-09T00:00:00Z", now).tone, "warn");
  assert.equal(timeLeft("2026-11-01T00:00:00Z", now).text, "Closed");
});
