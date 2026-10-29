import { test } from "node:test";
import assert from "node:assert/strict";
import { freeQueries, cleanQueries, queriesText } from "../lib/prebid.js";

test("free queries from eligibility gaps", () => {
  const q = freeQueries({
    tender: { req_avg_turnover: 50000000, req_similar_one: 20000000, emd_inr: 100000, mse_emd_exempt: false },
    reasons: [
      { ok: false, text: "Avg turnover Rs 2.1 Cr vs Rs 5 Cr required" },
      { ok: true, text: "Similar work: 3 completed" },
      { ok: false, ask: true, text: "Does your firm meet this condition: “ISO 9001 certified”?" },
      { ok: false, text: "Closes in 2 days — little time left" },
    ],
    firm: { msme: true },
  });
  assert.equal(q.length, 3);
  assert.match(q[0].query, /₹3 crore \(60%\)/);
  assert.match(q[1].says, /^ISO 9001 certified$/);
  assert.equal(q[2].clause, "EMD");
  assert.deepEqual(q.map((x) => x.n), [1, 2, 3]);
  assert.equal(freeQueries({ firm: { startup: true } })[0].clause, "Eligibility — prior turnover and experience");
});

test("AI answer checked and table text", () => {
  assert.equal(cleanQueries({ queries: [] }), null);
  const q = cleanQueries({ queries: [{ clause: "4.2", page: 7, says: "x", query: "Please clarify", why: "y" }, { clause: "no query" }] });
  assert.equal(q.length, 1);
  assert.equal(q[0].page, "7");
  assert.match(queriesText(q, { firm: "Garg & Co", tender: "Road" }), /^Pre-bid queries — Road\nFrom: Garg & Co\n\n1\. 4\.2 \(page 7\)/);
});
