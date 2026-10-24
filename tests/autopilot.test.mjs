import { test } from "node:test";
import assert from "node:assert/strict";
import { costPerLead, budgetPlan, pickBest, winnerRow, mapsQueries } from "../lib/autopilot.js";

test("cost per lead: finding + each sequence message + an optional 2-minute AI call", () => {
  assert.equal(costPerLead({ find: 2 }), 2);
  assert.equal(costPerLead({ find: 2, steps: [{ channel: "email" }, { channel: "whatsapp" }, { channel: "email" }] }), 2.4);
  assert.equal(costPerLead({ find: 2, call: true, prices: { ai_call_min: 8 } }), 18);
});

test("the daily budget buys whole leads, split over the chosen paid sources", () => {
  const p = budgetPlan(100, ["google_maps", "tender_winner", "apollo"], 2.4);
  assert.equal(p.total, 41);
  assert.deepEqual(p.split, [{ source: "google_maps", leads: 21 }, { source: "tender_winner", leads: 20 }]);
  assert.equal(p.monthly, 1230);
  assert.equal(budgetPlan(1, ["mca"], 2).total, 0);
  assert.deepEqual(budgetPlan(50, [], 2).split, []);
});

test("best leads first, under-score ones dropped", () => {
  const rows = [{ name: "A", phone: "9811111111", city: "Noida" }, { name: "B" }, { name: "C", phone: "9822222222", website: "x.in" }];
  const out = pickBest(rows, { n: 2, minScore: 20, ideal: { cities: ["Noida"] }, source: "google_maps" });
  assert.deepEqual(out.map((r) => r.name), ["A", "C"]);
  assert.ok(out[0].score_reasons.includes("City you serve"));
});

test("tender winner rows carry the award and why they are a lead", () => {
  const r = winnerRow({ bidder_name: "XYZ Infra", award_id: "a1", title: "Road work", authority: "PWD", awarded_value: 2500000, wins: 3, state: "Haryana" });
  assert.equal(r.award_id, "a1");
  assert.match(r.notes, /Won: Road work/);
  assert.match(r.notes, /3 wins/);
});

test("maps searches: every 'what' in every area", () => {
  assert.deepEqual(mapsQueries([{ what: "restaurant", areas: "Sector 18, Noida; Gurugram" }, { what: "", areas: "x" }]), ["restaurant in Sector 18, Noida", "restaurant in Gurugram"]);
});
