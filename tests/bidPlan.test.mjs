import { test } from "node:test";
import assert from "node:assert/strict";
import { planTasks, signoffState } from "../lib/bidPlan.js";

const now = new Date("2026-10-29T06:00:00Z");

test("plan counted back from the closing date", () => {
  const p = planTasks("2026-11-20T12:00:00Z", "2026-11-05", now);
  assert.equal(p.length, 10);
  const byTitle = Object.fromEntries(p.map((t) => [t.title, t.due_at]));
  assert.equal(byTitle["Arrange EMD / bank guarantee"], "2026-11-13T12:00:00.000Z");
  assert.equal(byTitle["Send pre-bid queries"], "2026-11-04T04:30:00.000Z");
  assert.ok(p.every((t) => new Date(t.due_at) > now));
});

test("squeezed when little time is left; nothing when closed", () => {
  const p = planTasks("2026-10-31T06:00:00Z", null, now);
  assert.equal(p.length, 9);
  assert.ok(p.every((t) => new Date(t.due_at) > now && new Date(t.due_at) < new Date("2026-10-31T06:00:00Z")));
  assert.deepEqual(planTasks("2026-10-01T00:00:00Z", null, now), []);
});

test("latest sign-off per step", () => {
  const s = signoffState([{ step: "technical", decision: "approved" }, { step: "technical", decision: "changes" }, { step: "finance", decision: "changes" }]);
  assert.equal(s.technical.decision, "approved");
  assert.equal(s.finance.decision, "changes");
  assert.equal(s.management, undefined);
});
