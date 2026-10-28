import { test } from "node:test";
import assert from "node:assert/strict";
import { weighted, pct, monthProgress, leaderboard, teamTotals } from "../lib/targets.js";

test("weighted pipeline and percentages", () => {
  assert.equal(weighted({ proposal: 100000, negotiation: 50000, won: 999 }), 100000);
  assert.equal(pct(50, 200), 25);
  assert.equal(pct(5, 0), null);
});

test("month progress in India time", () => {
  assert.equal(monthProgress("2026-10-01", new Date("2026-09-30T18:30:00Z")), 0);
  assert.ok(Math.abs(monthProgress("2026-10-01", new Date("2026-10-16T18:30:00Z")) - 0.5) < 0.02);
  assert.equal(monthProgress("2026-10-01", new Date("2026-12-01T00:00:00Z")), 1);
});

test("leaderboard ranks by % of target, then points", () => {
  const rows = [
    { user_id: "a", name: "A", won_value: 200000, meetings: 2, activities: 10, new_deals: 1, open_by_stage: { proposal: 100000 }, t_won: 400000, t_meetings: 4 },
    { user_id: "b", name: "B", won_value: 400000, meetings: 4, activities: 0, new_deals: 0, open_by_stage: {}, t_won: 400000, t_meetings: 4 },
    { user_id: "c", name: "C", won_value: 0, meetings: 5, activities: 50, new_deals: 3, open_by_stage: {} },
  ];
  const lb = leaderboard(rows, "2026-10-01", new Date("2026-10-16T18:30:00Z"));
  assert.deepEqual(lb.map((p) => p.user_id), ["b", "a", "c"]);
  assert.equal(lb[0].score, 100);
  assert.equal(lb[0].onTrack, true);
  assert.equal(lb[1].forecast, 260000);
  assert.equal(lb[1].forecastPct, 65);
  assert.equal(lb[1].onTrack, true); // 50% done, half the month gone (10-point grace)
  assert.equal(lb[2].score, null);
  assert.equal(lb[2].points, 5 * 3 + 3 * 2 + 50);
  assert.equal(teamTotals(lb).won, 600000);
  assert.equal(teamTotals(lb).target, 800000);
});
