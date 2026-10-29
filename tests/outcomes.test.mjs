import { test } from "node:test";
import assert from "node:assert/strict";
import { gapPct, outcomeStats } from "../lib/outcomes.js";

test("gap to L1", () => {
  assert.equal(gapPct(950000, 880000), 8);
  assert.equal(gapPct(880000, 880000), 0);
  assert.equal(gapPct(null, 1), null);
});

test("win rate, why we lose, where we win", () => {
  const s = outcomeStats([
    { status: "won", authority: "PWD", state: "Haryana" },
    { status: "lost", result_stage: "fin_opened", quoted_price: 110, l1_price: 100, authority: "PWD", state: "Haryana" },
    { status: "lost", result_stage: "fin_opened", quoted_price: 104, l1_price: 100, authority: "HSVP", state: "Haryana" },
    { status: "lost", result_stage: "tech_disqualified", result_reason: "Turnover short", authority: "HSVP", state: "Delhi" },
    { status: "lost", result_stage: "tech_disqualified", result_reason: "turnover short ", authority: "NHAI", state: "Delhi" },
    { status: "submitted", authority: "PWD", state: "Haryana" },
  ]);
  assert.equal(s.bids, 6);
  assert.equal(s.decided, 5);
  assert.equal(s.winRate, 20);
  assert.equal(s.disqualified, 2);
  assert.deepEqual(s.reasons, [{ reason: "turnover short", n: 2 }]);
  assert.equal(s.lostOnPrice, 2);
  assert.equal(s.medianGap, 4);
  assert.deepEqual(s.byAuthority[0], { key: "PWD", bids: 3, decided: 2, won: 1, lost: 1, winRate: 50 });
});
