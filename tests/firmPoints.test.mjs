import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePointsTable, pointsRows } from "../lib/firmPoints.js";

// real GeM wording (study text, Chhattisgarh audit bid)
const gem = `This Bid is based on Quality & Cost Based Selection (QCBS) . The parameter wise qualification requirement is as under:- Parameter Name Max Marks Cutoff Marks Qualification Methodology Document Number Of Years of Existence of the firm 20 10 View File Number of Full-Time Partners 10 5 View File Average Annual Turnover of the Firm During the Last Three Financial Years 10 5 View File Number of Statutory Concurrent Audit Assignments of Central PSUs State Government Organisations 20 10 View File Number of Qualified CISA or DISA Partners 10 5 View File Office Located in Chhattisgarh 10 10 View File Number of Qualified or Semi- Qualified Staff 20 5 View File Buyer Defined Total Qualifying Marks for Technical Qualification: 50 QCBS Weightage(Technical:Financial):70:30 Pre Bid Detail(s)`;

test("reads GeM's points table", () => {
  const t = parsePointsTable(gem);
  assert.equal(t.method, "QCBS");
  assert.equal(t.rows.length, 7);
  assert.deepEqual(t.rows[0], { name: "Number Of Years of Existence of the firm", max: 20, cutoff: 10 });
  assert.equal(t.rows[4].name, "Number of Qualified CISA or DISA Partners");
  assert.equal(t.qualifying, 50);
  assert.deepEqual([t.tech_weight, t.fin_weight], [70, 30]);
  assert.equal(parsePointsTable("no table here"), null);
});

test("each parameter with the firm's own figure", () => {
  const rows = pointsRows(parsePointsTable(gem), {
    facts: [{ key: "cred.partners", value: "4" }, { key: "cred.disa_cisa", value: "1" }, { key: "fin.turnover", period: "FY 2024-25", value: "3000000" }, { key: "presence.office.chhattisgarh", value: "yes" }],
    works: 6, incorporated: "2012-04-01",
  });
  const by = Object.fromEntries(rows.map((r) => [r.about, r]));
  assert.equal(by["Partners"].have, "4");
  assert.equal(by["DISA / CISA holders"].have, "1"); // CISA wins over "partners"
  assert.match(by["Years since set up"].have, /^1\d years$/);
  assert.match(by["Average turnover (3 years)"].have, /30.00 lakh/);
  assert.equal(by["Office in the state"].have, "Yes: chhattisgarh");
  assert.equal(by["Similar works in Experience"].have, "6 completed");
  assert.equal(by["Staff"].state, "ask");
});
