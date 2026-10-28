import { test } from "node:test";
import assert from "node:assert/strict";
import { matchSchemes } from "../lib/schemes.js";

const now = new Date("2026-10-28");
const by = (list) => Object.fromEntries(list.map((s) => [s.id, s]));

test("a small registered partnership firm", () => {
  const s = by(matchSchemes({ udyam_no: "UDYAM-HR-05-0012345", msme_category: "small", constitution: "partnership", incorporation_date: "2019-04-01" }, { "need.loan": "yes" }, now));
  assert.equal(s.udyam.status, "done");
  assert.equal(s.ppp_mse.status, "likely");
  assert.equal(s.cgtmse.status, "likely");
  assert.equal(s.startup.status, "likely");
  assert.match(s.startup.why, /7 years old/);
  assert.equal(s.treds.status, "check");
  assert.equal(s.treds.ask.key, "sells.to_large");
});

test("missing Udyam and unanswered questions are asked, never assumed", () => {
  const list = matchSchemes({}, {}, now);
  const s = by(list);
  assert.equal(s.udyam.status, "likely");
  assert.equal(s.ppp_mse.status, "check");
  assert.equal(s.standup.status, "check"); assert.equal(s.standup.ask.key, "owner.women");
  assert.equal(list[0].status, "likely");
});

test("rules that rule a scheme out", () => {
  const s = by(matchSchemes({ udyam_no: "U", msme_category: "medium", constitution: "proprietorship", incorporation_date: "2010-01-01" }, { "owner.women": "no", "owner.sc_st": "no", "plan.new_unit": "no" }, now));
  assert.equal(s.ppp_mse.status, "unlikely");
  assert.equal(s.standup.status, "unlikely");
  assert.equal(s.pmegp.status, "unlikely");
  assert.equal(s.startup.status, "unlikely");
});
