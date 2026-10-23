import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSegments, composeText, parseBlocks, blanksLeft, PEOPLE_COLS } from "../lib/annexure.js";
import { normaliseEval, techTotals, qcbsScore, maxPriceToBeat, l1Advice } from "../lib/evaluation.js";

const people = [{ id: "p1", name: "Ankit Garg", designation: "Partner", qualification: "FCA", membership_no: "512345", years_experience: 15 }, { id: "p2", name: "Asha Rao", designation: "Manager", qualification: "CA" }];
const works = [{ work_name: "Statutory audit", client: "HSIIDC", value_inr: 250000, end_date: "2025-03-31", status: "completed" }];

test("an annexure becomes fields and tables pre-filled from the masters", () => {
  const t = "Annexure 4\nFirm: GSC\nPartner: [TO BE FILLED: Name of Partner 1] PAN [TO BE FILLED: PAN No. of Partner 1]\nFax: [TO BE FILLED: Fax number]\n[TO BE FILLED: Complete table with qualified CA partners/employees]\nPage [TO BE FILLED: Tender Notice format template not provided]end";
  const s = buildSegments(t, { facts: [{ key: "master.fax_number", value: "0124-1" }], people, works });
  const fields = s.filter((x) => x.t === "field");
  assert.deepEqual(fields.map((f) => [f.kind, f.value]), [["partner", "Ankit Garg"], ["partner", ""], ["fact", "0124-1"]]);
  assert.equal(blanksLeft(s), 1);
  const table = s.find((x) => x.t === "table");
  assert.deepEqual(table.cols, PEOPLE_COLS);
  assert.equal(table.rows[0][0], "Ankit Garg");
  table.rows.push(["New Person", "Article", "", "", ""]);
  s.find((x) => x.t === "field" && !x.value).value = "ABCDE1234F";
  const out = composeText(s);
  assert.match(out, /Partner: Ankit Garg PAN ABCDE1234F/);
  assert.match(out, /⟦table Name\|Designation/);
  assert.match(out, /New Person\|Article\|\|\|/);
  assert.ok(!out.includes("not provided"));
  // an edited text opens again with its table, and the table prints as rows
  const again = buildSegments(out, { people, works });
  assert.equal(again.find((x) => x.t === "table").kind, "people");
  assert.equal(parseBlocks(out).find((b) => b.t === "table").rows.length, 3);
});

test("evaluation: methods, technical marks, QCBS and L1 prices", () => {
  const e = normaliseEval({ method: "QCBS (70:30)", tech_weight: 0.7, fin_weight: 0.3, criteria: [{ criterion: "Turnover", max_marks: 20, awarded: 15 }, { criterion: "Experience", max_marks: 30, awarded: 40 }, { criterion: "Presentation", max_marks: 50, awarded: null }] });
  assert.equal(e.method, "QCBS");
  assert.equal(e.tech_weight, 70);
  assert.equal(e.criteria[1].awarded, 30);
  assert.deepEqual(techTotals(e.criteria), { got: 45, max: 100, score: 45, unknown: 1 });
  assert.equal(normaliseEval({ method: "Lowest price (L1)" }).method, "L1");
  // you 80 tech at Rs 10 lakh; rival 70 tech at Rs 9 lakh
  assert.deepEqual(qcbsScore({ tech: 80, price: 1000000, lowest: 900000, tw: 70, fw: 30 }), { fin: 90, final: 83 });
  assert.deepEqual(qcbsScore({ tech: 70, price: 900000, lowest: 900000, tw: 70, fw: 30 }), { fin: 100, final: 79 });
  const max = maxPriceToBeat({ myTech: 80, rivalTech: 70, rivalPrice: 900000, tw: 70, fw: 30 });
  assert.ok(max > 1000000 && max < 1300000);
  assert.ok(qcbsScore({ tech: 80, price: max, lowest: 900000, tw: 70, fw: 30 }).final >= 79 - 0.01);
  assert.ok(maxPriceToBeat({ myTech: 60, rivalTech: 70, rivalPrice: 900000, tw: 70, fw: 30 }) < 900000);
  assert.deepEqual(l1Advice({ cost: 100000, estimate: 120000 }), { price: 105000, belowEstimatePct: 12.5, aboveEstimate: false });
});

import { mandatoryUnmet } from "../lib/conditions.js";
test("only real mandatory conditions raise the warning", () => {
  assert.deepEqual(mandatoryUnmet([
    { ok: false, text: "Outside the industries and keywords you chose" }, { ok: false, text: "Similar work: needs 1 work of Rs 6.91 Cr" },
    { ok: false, text: "Value outside your preferred range" }, { ok: false, text: "Closes in 0 days — little time left" },
    { ok: false, text: "Expired: Bank solvency certificate — renew before bidding" }, { ok: false, text: "Needs: Office location in Varanasi (mandatory)" }, { ok: true, text: "ICAI registration" },
  ]), ["Similar work: needs 1 work of Rs 6.91 Cr", "Needs: Office location in Varanasi (mandatory)"]);
});
