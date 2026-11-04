import test from "node:test";
import assert from "node:assert/strict";
import { evalFromPoints } from "../lib/evaluation.js";
test("evalFromPoints builds a free QCBS evaluation from GeM's table", () => {
  const ev = evalFromPoints({ method: "QCBS", tech_weight: 70, fin_weight: 30, qualifying: 60, rows: [{ name: "Number of partners", max: 20, cutoff: 5 }, { name: "Turnover", max: 30, cutoff: 0 }] },
    [{ have: "4", about: "Partners" }, { have: null, about: "Average turnover (3 years)" }]);
  assert.equal(ev.method, "QCBS");
  assert.equal(ev.tech_weight, 70);
  assert.equal(ev.min_tech, 60);
  assert.equal(ev.criteria.length, 2);
  assert.equal(ev.criteria[0].awarded, null);
  assert.match(ev.criteria[0].basis, /Your figure: 4/);
  assert.match(ev.criteria[1].basis, /Not in your Vault/);
  assert.equal(ev.free, true);
  assert.equal(evalFromPoints(null), null);
});
