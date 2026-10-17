import test from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync, crc32 } from "node:zlib";
import { readXlsx, excelDate } from "../lib/xlsx.js";
import { mcaFromRows, parseCin, parseDay, nicSection } from "../lib/mca.js";

// Builds a minimal .xlsx (zip of XML parts) the way Excel lays it out: shared strings + one sheet.
function makeXlsx(rows) {
  const strings = [];
  const si = (s) => { let i = strings.indexOf(s); if (i < 0) { strings.push(s); i = strings.length - 1; } return i; };
  const col = (i) => String.fromCharCode(65 + i);
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const sheet = `<worksheet><sheetData>${rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => v === null ? "" :
    typeof v === "number" ? `<c r="${col(ci)}${ri + 1}"><v>${v}</v></c>` : `<c r="${col(ci)}${ri + 1}" t="s"><v>${si(v)}</v></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
  const sst = `<sst>${strings.map((s) => `<si><t>${esc(s)}</t></si>`).join("")}</sst>`;
  const parts = [["xl/worksheets/sheet1.xml", sheet], ["xl/sharedStrings.xml", sst]];
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, text] of parts) {
    const raw = Buffer.from(text), data = deflateRawSync(raw), nameB = Buffer.from(name);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(8, 8);
    h.writeUInt32LE(crc32(raw), 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(nameB.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc32(raw), 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(nameB.length, 28); c.writeUInt32LE(offset, 42);
    locals.push(h, nameB, data); centrals.push(c, nameB);
    offset += 30 + nameB.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(parts.length, 8); end.writeUInt16LE(parts.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

test("reads an .xlsx sheet, keeping blank cells in place", () => {
  const buf = makeXlsx([["CIN", "Company Name", "Date of Incorporation"], ["U72200HR2026PTC123456", "Aarav Tech & Labs Private Limited", 46279], ["A", null, "x"]]);
  const rows = readXlsx(buf);
  assert.deepEqual(rows[0], ["CIN", "Company Name", "Date of Incorporation"]);
  assert.equal(rows[1][1], "Aarav Tech & Labs Private Limited");
  assert.deepEqual(rows[2], ["A", "", "x"]);
  assert.equal(excelDate(46279), "2026-09-14");
  assert.throws(() => readXlsx(Buffer.from("not a zip at all, just text")), /not an .xlsx/);
});

test("CIN tells state, activity and type", () => {
  assert.deepEqual(parseCin("u72200hr2026ptc123456"), { cin: "U72200HR2026PTC123456", listed: false, activity_code: "72200", state: "Haryana", year: 2026, type: "PTC" });
  assert.deepEqual(parseCin("ACB-1234"), { cin: "ACB-1234", type: "LLP" });
  assert.equal(parseCin("12345"), null);
  assert.equal(nicSection("41001"), "Construction");
  assert.equal(nicSection("62099"), "Information technology & media");
  assert.equal(nicSection("68100"), "Real estate");
});

test("dates in the formats MCA files use", () => {
  assert.equal(parseDay("14-09-2026"), "2026-09-14");
  assert.equal(parseDay("14/Sep/2026"), "2026-09-14");
  assert.equal(parseDay("2026-09-14T00:00:00"), "2026-09-14");
  assert.equal(parseDay("46279"), "2026-09-14");
  assert.equal(parseDay("31-13-2026"), null);
});

test("MCA monthly list → companies", () => {
  const rows = [
    ["Companies registered during September 2026"],
    ["CIN", "Company Name", "Date of Incorporation", "ROC", "Category", "Class", "Authorized Capital (Rs.)", "Paid up Capital (Rs.)", "Activity Description", "Registered Office Address", "Email"],
    ["U41001HR2026PTC123456", "Shree Ram Infra Projects Private Limited", "14-09-2026", "ROC Delhi", "Company limited by Shares", "Private", "10,00,000", "1,00,000", "", "Plot 7, Sector 44, Gurugram, Haryana 122003", "Accounts@ShreeRam.example"],
    ["AAB-1234", "Kaveri Consultants LLP", "02/09/2026", "ROC Bangalore", "", "", "", "50000", "Management consultancy", "12 MG Road, Bengaluru 560001", "not-an-email"],
    ["BAD", "No CIN Pvt Ltd"],
  ];
  const r = mcaFromRows(rows);
  assert.equal(r.skipped, 1);
  assert.equal(r.companies.length, 2);
  const [a, b] = r.companies;
  assert.equal(a.state, "Haryana"); assert.equal(a.activity, "Construction"); assert.equal(a.activity_code, "41001");
  assert.equal(a.paid_up_capital, 100000); assert.equal(a.pincode, "122003"); assert.equal(a.email, "accounts@shreeram.example");
  assert.equal(a.incorporated_on, "2026-09-14"); assert.equal(a.class, "Private");
  assert.equal(b.kind, "llp"); assert.equal(b.activity, "Management consultancy"); assert.equal(b.email, null); assert.equal(b.paid_up_capital, 50000);
  assert.match(mcaFromRows([["Name"], ["X"]]).error, /CIN/);
});
