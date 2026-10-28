import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { boqFromRows, boqFromSheets, findHeader, toPlannerItems } from "../lib/boq.js";
import { readWorkbook } from "../lib/sheets.js";
import { cleanSheet, BOQ_MAX } from "../lib/costing.js";

const NIC = [
  ["Tender Inviting Authority: Executive Engineer, PWD"],
  ["Name of Work: Annual maintenance of office"],
  ["Contract No: 12/EE/2026"],
  ["BIDDER NAME :", "", "", "", "", "", "", ""],
  ["Sl. No.", "Item Description", "Item Code / Make", "Quantity", "Units", "Estimated Rate", "BASIC RATE In Figures To be entered by the Bidder Rs. P", "TOTAL AMOUNT Without Taxes"],
  [1, 2, 3, 4, 5, 6, 7, 8],
  ["NUMBER #", "TEXT #", "TEXT #", "NUMBER #", "TEXT #", "NUMBER #", "NUMBER #", "NUMBER #"],
  ["1.00", "Civil work"],
  ["1.01", "  Providing and fixing   ceramic tiles\n in toilets ", "", "45.5", "Sqm", "1,250.00", "", 0],
  [1.02, "Cleaning of water tank", "", 4, "Each", "", "", 0],
  ["", "Total in Figures", "", "", "", "", "", 0],
  ["", "Quoted Rate in Words", "", "", "", "", "", "INR Zero Only"],
];

test("NIC BOQ: header found, numbering/type/heading/total rows skipped", () => {
  assert.equal(findHeader(NIC).at, 4);
  assert.deepEqual(findHeader(NIC).col, { desc: 1, qty: 3, unit: 4, rate: 5 });
  assert.deepEqual(boqFromRows(NIC), [
    { description: "Providing and fixing ceramic tiles in toilets", unit: "Sqm", qty: 45.5, rate: 1250 },
    { description: "Cleaning of water tank", unit: "Each", qty: 4, rate: null },
  ]);
});

test("a header over two lines, an estimated amount instead of a rate, and no unit column", () => {
  const rows = [
    ["S.No", "Particulars", "Qty", "Estimated", "Bidder"],
    ["", "", "", "Amount (Rs)", "Rate"],
    [1, "Statutory audit FY 2025-26", 1, 250000, ""],
    [2, "GST audit", 2, 90000, ""],
    ["", "Grand Total", "", 340000],
  ];
  assert.deepEqual(boqFromRows(rows), [
    { description: "Statutory audit FY 2025-26", unit: "", qty: 1, rate: 250000 },
    { description: "GST audit", unit: "", qty: 2, rate: 45000 },
  ]);
  assert.deepEqual(boqFromRows([["just", "a", "list"], ["no", "header", "here"]]), []);
});

test("the sheet with the BOQ wins; planner items keep the planner's shape and a long sheet is stored", () => {
  const r = boqFromSheets([{ name: "Cover", rows: [["Read the instructions"]] }, { name: "BoQ1", rows: NIC }]);
  assert.equal(r.sheet, "BoQ1");
  assert.equal(r.items.length, 2);
  assert.deepEqual(toPlannerItems(r.items), [
    { item: "Providing and fixing ceramic tiles in toilets", unit: "Sqm", qty: "45.5", rate: "1250" },
    { item: "Cleaning of water tank", unit: "Each", qty: "4", rate: "" },
  ]);
  const long = toPlannerItems([{ description: "x".repeat(600), unit: "", qty: 1, rate: null }])[0];
  assert.equal(long.item.length, 400);
  assert.equal(long.unit, "job");
  const many = Array.from({ length: 350 }, (_, i) => ({ item: `Item ${i} ${"y".repeat(300)}`, unit: "Nos", qty: "1", rate: "" }));
  const kept = cleanSheet({ boq: many }).boq;
  assert.equal(kept.length, BOQ_MAX);
  assert.ok(kept[0].item.length > 300);
});

// An .xlsx (zip of XML) with a workbook listing two sheets; the BOQ is on the second.
function makeXlsx(sheets) {
  const parts = [
    ["xl/workbook.xml", `<workbook><sheets>${sheets.map((s, i) => `<sheet name="${s.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<Relationships>${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}</Relationships>`],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, `<worksheet><sheetData>${s.rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) =>
      typeof v === "number" ? `<c r="${String.fromCharCode(65 + ci)}${ri + 1}"><v>${v}</v></c>` : `<c r="${String.fromCharCode(65 + ci)}${ri + 1}" t="inlineStr"><is><t>${v.replace(/&/g, "&amp;")}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`]),
  ];
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, text] of parts) {
    const raw = Buffer.from(text), data = deflateRawSync(raw), nameB = Buffer.from(name);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(8, 8); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(nameB.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(8, 10); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(nameB.length, 28); c.writeUInt32LE(offset, 42);
    locals.push(h, nameB, data); centrals.push(c, nameB);
    offset += 30 + nameB.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(parts.length, 8); end.writeUInt16LE(parts.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

test(".xlsx: every sheet read in workbook order, numbers kept as numbers", async () => {
  const sheets = await readWorkbook(makeXlsx([{ name: "Notes", rows: [["Read me"]] }, { name: "BoQ1", rows: [["Item Description", "Quantity", "Units"], ["Repair & painting", 3, "Job"]] }]));
  assert.deepEqual(sheets.map((s) => s.name), ["Notes", "BoQ1"]);
  assert.deepEqual(sheets[1].rows[1], ["Repair & painting", 3, "Job"]);
  assert.deepEqual(boqFromSheets(sheets).items, [{ description: "Repair & painting", unit: "Job", qty: 3, rate: null }]);
  await assert.rejects(readWorkbook(Buffer.from("<html><table></table></html>")), /not an Excel file/);
});
