import test from "node:test";
import assert from "node:assert/strict";
import { resultColumns, parseResultsList, parseAoc, cityFrom } from "../src/adapters/gepnicResults.js";

const site = { portal: "Haryana e-Procurement", state: "Haryana" };

test("results list: columns by header, skips cancelled", () => {
  const header = ["S.No", "AOC Date", "Tender ID", "Title and Ref.No.", "Organisation Chain", "Tender Stage"];
  assert.deepEqual(resultColumns(header), { id: 2, title: 3, org: 4, date: 1, stage: 5 });
  const rows = [
    { cells: ["1.", "05-Oct-2026", "2026_HRY_400111_1", "[Construction of boundary wall at GSSS Pataudi] [EE/PWD/12]", "PWD B&R||Gurugram Division", "AOC"], href: "/nicgep/app?component=view&id=1" },
    { cells: ["2.", "04-Oct-2026", "2026_HRY_400222_1", "[Supply of tablets] [DSE/3]", "Education Department", "Cancelled"], href: "/x" },
    { cells: ["3.", "03-Oct-2026", "", "[No id here]", "X", "AOC"], href: "/y" },
  ];
  const r = parseResultsList(header, rows, site);
  assert.equal(r.length, 1);
  assert.equal(r[0].tender_ref, "2026_HRY_400111_1");
  assert.equal(r[0].title, "Construction of boundary wall at GSSS Pataudi");
  assert.equal(r[0].authority, "PWD B&R");
  assert.equal(r[0].industry_pack, "construction");
  assert.equal(r[0].listed_on, "2026-10-05");
});

test("AOC: label/value layout with two selected bidders", () => {
  const tables = [[
    ["Tender ID :", "2026_HRY_400111_1", "Contract Date :", "02-Oct-2026"],
    ["Contract Value (in ₹)", "48,75,000.00", "Name of the Selected Bidder(s)", "Shiv Shakti Builders\nM/s Rao Constructions"],
    ["Address of the Selected Bidder(s)", "Sector 10, Rewari, Haryana - 123401\nVPO Jatusana, Rewari, Haryana", "", ""],
  ]];
  const r = parseAoc(tables);
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], { bidder_name: "Shiv Shakti Builders", bidder_address: "Sector 10, Rewari, Haryana - 123401", awarded_value: 4875000, contract_date: "2026-10-02" });
  assert.equal(r[1].bidder_name, "M/s Rao Constructions");
});

test("AOC: bidders table picks the awarded row", () => {
  const tables = [
    [["Contract Date", "28-Sep-2026 11:00 AM"]],
    [["S.No", "Bidder Name", "Bidder Address", "Awarded Value", "Status"],
     ["1", "Aravali Infra Developers LLP", "Plot 12, Sector 37, Gurugram, Haryana - 122001", "1,10,00,000", "AOC"],
     ["2", "Kumar & Sons", "Faridabad", "1,15,00,000", "Not Selected"]],
  ];
  const r = parseAoc(tables);
  assert.equal(r.length, 1);
  assert.equal(r[0].bidder_name, "Aravali Infra Developers LLP");
  assert.equal(r[0].awarded_value, 11000000);
  assert.equal(r[0].contract_date, "2026-09-28");
});

test("AOC: nothing to read", () => {
  assert.deepEqual(parseAoc([[["Tender ID", "X"]]]), []);
});

test("city from address", () => {
  assert.equal(cityFrom("Plot 12, Sector 37, Gurugram, Haryana - 122001"), "Gurugram");
  assert.equal(cityFrom("VPO Jatusana, Rewari, Haryana"), "Rewari");
  assert.equal(cityFrom("12 MG Road, Pune 411001, Maharashtra, India"), "Pune");
  assert.equal(cityFrom(""), null);
});
