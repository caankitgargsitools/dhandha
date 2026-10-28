import { test } from "node:test";
import assert from "node:assert/strict";
import { winChance, featuresOf, MIN_CLOSED } from "../lib/winChance.js";

const C = "c1";
const row = (feature, value, won, lost, company_id = C) => ({ company_id, feature, value, won, lost });

test("features mirror the SQL list", () => {
  const f = Object.fromEntries(featuresOf({ source: "referral", score: 65, email: "a@b.in", phone: "", industry: " Hotels ", city: null, wa_opt_in: true }));
  assert.deepEqual(f, { source: "referral", fit: "60-79", email: "true", phone: "false", website: "false", person: "false", whatsapp: "true", referred: "false", industry: "hotels" });
});

test("no number until enough deals are closed", () => {
  const r = winChance({ source: "referral" }, [row("_all", "_all", 1, 1)]);
  assert.equal(r.p, null);
  assert.equal(r.need, MIN_CLOSED);
});

test("referrals with email win more than cold lists", () => {
  const rows = [
    row("_all", "_all", 10, 30),
    row("source", "referral", 8, 2), row("source", "upload", 2, 28),
    row("email", "true", 9, 10), row("email", "false", 1, 20),
  ];
  const hot = winChance({ source: "referral", email: "x@y.in" }, rows);
  const cold = winChance({ source: "upload" }, rows);
  assert.ok(hot.p > 60, String(hot.p));
  assert.ok(cold.p < 10, String(cold.p));
  assert.equal(hot.basis, "your deals");
  assert.equal(hot.up[0].text, "came from a referral");
  assert.ok(cold.down.some((d) => d.text === "came from an imported list"));
});

test("falls back to everyone's numbers for a new workspace", () => {
  const rows = [row("_all", "_all", 0, 1), row("_all", "_all", 40, 60, null), row("source", "google_ads", 20, 10, null)];
  const r = winChance({ source: "google_ads" }, rows);
  assert.equal(r.basis, "all Dhandha workspaces");
  assert.ok(r.p > 40);
});
