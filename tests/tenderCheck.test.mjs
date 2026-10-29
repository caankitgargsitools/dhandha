import { test } from "node:test";
import assert from "node:assert/strict";
import { firmProfile, buildPrompt, validateAnswer, mapAnswer } from "../lib/tenderCheck.js";
import { parseJson } from "../lib/json.js";

test("profile names the services with plain words, never rule syntax", () => {
  const p = firmProfile(["pro.consult.pmc", "pro.audit.statutory"], ["GST refund"]);
  assert.match(p, /Project monitoring units/);
  assert.match(p, /PMU/);
  assert.doesNotMatch(p, /financ\|/);
  assert.match(p, /Also: GST refund/);
});

test("prompt lists each tender with a short key and its details", () => {
  const s = buildPrompt("- Audit", [{ id: "a", title: "Hiring of CA firm", authority: "NHAI" }, { id: "b", title: "Road  repair", summary: "Patch work" }]);
  assert.match(s, /t1: Hiring of CA firm\n   buyer: NHAI/);
  assert.match(s, /t2: Road repair\n   details: Patch work/);
});

test("answers are checked and mapped back to the matches", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(validateAnswer({ results: [{ key: "t1", fit: "yes" }] }, 3), "only 1 of 3 answered");
  assert.equal(validateAnswer({ results: [{ fit: "yes" }, { fit: "no" }, { fit: "perhaps" }] }, 3), "unknown fit value");
  assert.equal(validateAnswer({ results: [{ fit: "YES" }, { fit: "no" }, { fit: "maybe" }] }, 3), null);
  assert.deepEqual(mapAnswer({ results: [{ key: "t2", fit: "No", reason: "Civil works" }, { key: "t9", fit: "yes" }] }, items), [{ id: "b", fit: "no", reason: "Civil works" }]);
});

test("a list given as one JSON object per line is still read", () => {
  const d = parseJson('{"key":"t1","fit":"yes","reason":"CA firm"}\n{"key":"t2","fit":"no","reason":"road works"}');
  assert.equal(validateAnswer(d, 2), null);
  assert.deepEqual(mapAnswer(d, [{ id: "a" }, { id: "b" }]).map((x) => x.fit), ["yes", "no"]);
  assert.deepEqual(parseJson('```json\n{"results":[]}\n```'), { results: [] });
});

test("the firm's own decisions go into the prompt", async () => {
  const { buildPrompt, exampleLines } = await import("../lib/tenderCheck.js");
  assert.equal(exampleLines({}), "");
  const p = buildPrompt("- Audit", [{ title: "Concurrent audit" }], { yes: ["Internal audit of PSU"], no: ["Energy  audit of buildings"] });
  assert.match(p, /\+ Internal audit of PSU/);
  assert.match(p, /- Energy audit of buildings/);
  assert.ok(p.indexOf("past decisions") < p.indexOf("Tenders:"));
});
