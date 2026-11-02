import { test } from "node:test";
import assert from "node:assert/strict";
import { extractConditions, conditionsFromLines, checkConditions, openQuestions, mandatoryUnmet } from "../lib/conditions.js";

const keys = (cs) => cs.map((c) => c.key);

test("branch office in a named state", () => {
  const cs = extractConditions(["2. Eligibility. The bidder must have a branch office in Bihar with valid trade licence. The firm shall be GST registered in the State of Bihar."]);
  assert.deepEqual(keys(cs), ["presence.office.bihar", "gst.state.bihar"]);
  assert.equal(cs[0].question, "Do you have a branch or office in Bihar?");
  assert.equal(cs[0].page, 1);
});

test("office in 'the state' uses the tender's own state", () => {
  const cs = extractConditions(["The agency should have a registered office within the State at the time of bidding."], { state: "Haryana" });
  assert.deepEqual(keys(cs), ["presence.office.haryana"]);
});

test("no requirement word, no condition", () => {
  assert.deepEqual(extractConditions(["Our head office in Delhi will process the payments."]), []);
});

test("ISO, contractor class, years in business", () => {
  const cs = extractConditions(["(i) The bidder should possess valid ISO 9001:2015 and ISO 14001 certificates. (ii) The bidder must be registered as Class II contractor with CPWD. (iii) The firm should be in existence for at least five years."]);
  assert.deepEqual(keys(cs), ["cert.iso_9001", "cert.iso_14001", "reg.contractor.cpwd.class_ii", "age.years_5"]);
});

test("AI lines: known ones share keys, others get a stable key, numbers are skipped", () => {
  const a = conditionsFromLines(["Bidder must have an office in Uttar Pradesh", "Valid electrical licence from CEIG", "Average turnover Rs 2 Cr"]);
  assert.equal(a.length, 2);
  assert.equal(a[0].key, "presence.office.uttar_pradesh");
  const b = conditionsFromLines(["Valid electrical licence from CEIG."]);
  assert.equal(b[0].key, a[1].key);
});

test("answers decide met / failed / pending; questions are grouped", () => {
  const c1 = [{ key: "presence.office.bihar", question: "q1" }, { key: "cert.iso_9001", question: "q2" }];
  const r = checkConditions(c1, { "presence.office.bihar": "Yes" });
  assert.equal(r.met.length, 1); assert.equal(r.pending.length, 1);
  assert.equal(checkConditions(c1, { "cert.iso_9001": "no" }).failed.length, 1);
  const qs = openQuestions([{ id: "m1", tenders: { title: "A", conditions: c1 } }, { id: "m2", tenders: { title: "B", conditions: [c1[1]] } }], {});
  assert.equal(qs[0].key, "cert.iso_9001");
  assert.equal(qs[0].tenders.length, 2);
});

test("mandatoryUnmet: preferred states are a preference, unanswered questions are pending", () => {
  const unmet = mandatoryUnmet([
    { ok: false, text: "Bihar is not in your preferred states" },
    { ok: false, text: " is not in your preferred states" },
    { ok: false, ask: true, text: "Branch or office in Bihar" },
    { ok: false, text: "Turnover below the minimum" },
    { ok: true, text: "ISO 9001 certificate" },
  ]);
  assert.deepEqual(unmet, ["Turnover below the minimum"]);
});

test("conditions written in the negative are asked plainly, with outcome buttons (owner, 2 Nov)", async () => {
  const { plainCondition, askOf, conditionsFromLines } = await import("../lib/conditions.js");
  const gp = plainCondition("Firm independent; has not prepared accounts/records of the GP units assigned (affidavit/undertaking).");
  assert.equal(gp.question, "Has your firm prepared accounts/records of the GP units assigned?");
  assert.equal(gp.ok, "no");
  assert.equal(gp.meet, "No — we qualify ✓");
  assert.equal(gp.fail, "Yes — we don't qualify ✗");
  assert.equal(gp.needs, "an affidavit / undertaking");
  assert.equal(plainCondition("The bidder should not have been blacklisted by any Government department.").question, "Has your firm ever been blacklisted by any Government department?");
  assert.equal(plainCondition("There should be no pending litigation with the department.").question, "Is there any pending litigation with the department?");
  const plain = plainCondition("The firm must have a valid labour licence.");
  assert.equal(plain.ok, null);
  assert.equal(plain.meet, "We meet this ✓");
  // the AI reader's own plain question wins, with its qualifying answer
  const [c] = conditionsFromLines(["Bidder must not be a related party of the client."], {}, [], [{ condition: "Bidder must not be a related party of the client.", question: "Is your firm related to the client?", qualifies_if: "no" }]);
  assert.match(c.question, /\[ok:no\]$/);
  assert.deepEqual([askOf(c).question, askOf(c).meet], ["Is your firm related to the client?", "No — we qualify ✓"]);
  // a condition saved before this change is rephrased when shown
  assert.equal(askOf({ question: "Does your firm meet this condition: “Bidder shall not have been debarred.”?", quote: "Bidder shall not have been debarred." }).question, "Has your firm ever been debarred?");
  // the shared yes/no rules stay as they are
  assert.equal(askOf({ question: "Do you have a branch or office in Bihar?" }).meet, "Yes — we qualify ✓");
});
