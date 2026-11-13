import test from "node:test";
import assert from "node:assert/strict";
import { scheduleStatus, jobList, workSummary } from "../lib/workProgress.js";

const now = new Date("2026-11-13T06:00:00Z");

test("schedule status", () => {
  assert.equal(scheduleStatus({ start: "2026-11-01", end: "2026-11-30", progress: 40 }, now).tone, "ok");
  const b = scheduleStatus({ start: "2026-10-01", end: "2026-11-30", progress: 20 }, now);
  assert.equal(b.tone, "bad");
  assert.match(b.label, /Behind/);
  assert.equal(scheduleStatus({ start: "2026-10-01", end: "2026-11-10", progress: 80 }, now).label, "2 days past the end date at 80%");
  assert.equal(scheduleStatus({ start: "2026-10-01", end: "2026-12-30", progress: 100 }, now).tone, "ok");
  assert.equal(scheduleStatus({ progress: null }, now).label, "No update yet");
  assert.equal(scheduleStatus({ start: "2026-10-01", end: "2026-12-30" }, now).tone, "warn");
});

test("job list joins updates, puts problems first, summary", () => {
  const rows = jobList({
    matches: [{ id: "a", tenders: { title: "Audit", authority: "DFO" }, contract_value: 100000, work_start: "2026-11-01", work_end: "2026-11-30" }],
    deals: [{ id: "b", title: "Website", leads: { name: "Acme" }, value_inr: 50000 }],
    updates: [
      { match_id: "a", progress: 30, crew: 3, created_at: "2026-11-12T10:00:00Z" },
      { deal_id: "b", progress: 50, issue: true, note: "Client not giving access", crew: 2, created_at: "2026-11-12T11:00:00Z" },
    ],
  }, now);
  assert.equal(rows[0].id, "b");
  assert.ok(rows[0].issue);
  assert.equal(rows[1].progress, 30);
  assert.deepEqual(workSummary(rows), { jobs: 2, value: 150000, behind: 0, issues: 1, crew: 5, quiet: 0 });
});
