import { test } from "node:test";
import assert from "node:assert/strict";
import { eligibilityLines, groupLines } from "../lib/eligLines.js";

const page = `3. Eligibility Criteria. (a) The bidder must have a valid PSARA licence. (b) The bidder should have an office in Uttar Pradesh.
(c) The bidder must have executed at least one similar work of value Rs 10 lakh. (d) The firm must be registered with the Directorate of Fire Services as an approved fire safety agency.
(e) The bidder shall submit bid security of Rs 50,000. (f) The tenderer must not be a related party of the client and must give an undertaking to that effect.
(g) The agency should be empanelled with the State Pollution Control Board as an environmental laboratory.`;

test("keeps only the eligibility sentences no rule understands", () => {
  const lines = eligibilityLines([page]);
  assert.ok(lines.some((l) => /Directorate of Fire Services/.test(l)));
  assert.ok(lines.some((l) => /Pollution Control Board/.test(l)));
  assert.ok(!lines.some((l) => /PSARA/.test(l)), "a known credential");
  assert.ok(!lines.some((l) => /office in Uttar Pradesh/.test(l)), "a known condition");
  assert.ok(!lines.some((l) => /bid security/.test(l)), "not a bidder condition");
  assert.ok(!lines.some((l) => /similar work/.test(l)), "checked elsewhere");
});

test("groups the same requirement across tenders", () => {
  const g = groupLines([
    { line: "The firm must be registered with the Directorate of Fire Services as an approved agency", tenders: 4 },
    { line: "Bidder should be registered with Directorate of Fire Services as approved agency", tenders: 2 },
    { line: "The agency should be empanelled with the State Pollution Control Board", tenders: 3 },
  ]);
  assert.equal(g.length, 2);
  assert.equal(g[0].tenders, 6);
  assert.equal(g[0].variants.length, 1);
});
