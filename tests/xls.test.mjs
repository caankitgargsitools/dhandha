import { test } from "node:test";
import assert from "node:assert/strict";
import { readXls } from "../lib/xls.js";
import { readWorkbook } from "../lib/sheets.js";
import { boqFromSheets, toPlannerItems } from "../lib/boq.js";

// ---- A tiny .xls built byte by byte: BIFF8 records inside a Compound File, laid out the way Excel writes it ----
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
const f64 = (n) => { const b = Buffer.alloc(8); b.writeDoubleLE(n); return b; };
const rec = (type, ...parts) => { const d = Buffer.concat(parts); return Buffer.concat([u16(type), u16(d.length), d]); };
const cell = (r, c, xf = 15) => Buffer.concat([u16(r), u16(c), u16(xf)]);
const xlstr = (s) => { const wide = /[^\x00-\xff]/.test(s); return Buffer.concat([u16(s.length), Buffer.from([wide ? 1 : 0]), Buffer.from(s, wide ? "utf16le" : "latin1")]); };
const rkInt = (n, cents = false) => ((n << 2) | 2 | (cents ? 1 : 0)) >>> 0;
const rkFloat = (x) => f64(x).readUInt32LE(4) & 0xfffffffc; // a double whose low 34 bits are zero

const LONG = "Providing and laying cement concrete 1:2:4 (1 cement : 2 coarse sand : 4 graded stone aggregate 20 mm nominal size) सीमेंट कंक्रीट, excluding the cost of centering and shuttering - All work up to plinth level";

function makeWorkbookStream({ pad = 0 } = {}) {
  // shared strings; "Item Description" is split across SST → CONTINUE, and its tail switches to UTF-16
  const sst = ["Name of Work: Repair of office building", "Sl. No.", "Quantity", "Units", "Estimated Rate", "TOTAL AMOUNT Without Taxes", LONG, "Cum", "Civil work", "Total in Figures"];
  const sstBody = Buffer.concat(sst.map(xlstr));
  const head = Buffer.concat([u32(sst.length + 1), u32(sst.length + 1), sstBody, u16(16), Buffer.from([0]), Buffer.from("Item Desc", "latin1")]);
  const sstRecs = Buffer.concat([rec(0x00fc, head), rec(0x003c, Buffer.from([1]), Buffer.from("ription", "utf16le"))]);
  const S = (s) => (s === "Item Description" ? sst.length : sst.indexOf(s));
  const lsst = (r, c, s) => rec(0x00fd, cell(r, c), u32(S(s)));

  const sheet1 = Buffer.concat([
    rec(0x0809, u16(0x0600), u16(0x0010), u32(0), u32(0)),
    rec(0x0012, u16(1)),                                                     // PROTECT: sheet locked, still readable
    lsst(0, 0, "Name of Work: Repair of office building"),
    rec(0x0204, cell(1, 0), xlstr("BIDDER NAME")),                            // LABEL
    lsst(2, 0, "Sl. No."), lsst(2, 1, "Item Description"), lsst(2, 2, "Quantity"), lsst(2, 3, "Units"), lsst(2, 4, "Estimated Rate"), lsst(2, 5, "TOTAL AMOUNT Without Taxes"),
    rec(0x00bd, u16(3), u16(0), ...[1, 2, 3, 4, 5, 6].flatMap((n) => [u16(15), u32(rkInt(n))]), u16(5)), // MULRK: column numbers
    lsst(4, 1, "Civil work"),                                                 // heading, no quantity
    rec(0x027e, cell(5, 0), u32(rkInt(1))),
    lsst(5, 1, LONG),
    rec(0x0203, cell(5, 2), f64(12.5)),                                       // NUMBER
    lsst(5, 3, "Cum"),
    rec(0x027e, cell(5, 4), u32(rkInt(45050, true))),                         // RK ÷100 → 450.5
    rec(0x0006, cell(5, 5), f64(5631.25), u16(0), u32(0), u16(0)),            // FORMULA, numeric result
    rec(0x027e, cell(6, 0), u32(rkInt(2))),
    rec(0x0006, cell(6, 1), Buffer.from([0, 0, 0, 0, 0, 0, 0xff, 0xff]), u16(0), u32(0), u16(0)), // FORMULA → string
    rec(0x0207, xlstr("Painting with acrylic emulsion")),                    // its STRING
    rec(0x027e, cell(6, 2), u32(rkFloat(100))),                               // RK as a truncated double
    rec(0x0204, cell(6, 3), xlstr("Sqm")),
    rec(0x0205, cell(6, 6), Buffer.from([1, 0])),                             // BOOLERR TRUE
    lsst(7, 1, "Total in Figures"),
    rec(0x0006, cell(7, 5), f64(5631.25), u16(0), u32(0), u16(0)),
    rec(0x000a),
  ]);
  const sheet2 = Buffer.concat([rec(0x0809, u16(0x0600), u16(0x0010), u32(0), u32(0)), rec(0x0204, cell(0, 0), xlstr("hidden note")), rec(0x000a)]);

  const bound = (pos, name, hidden) => rec(0x0085, u32(pos), Buffer.from([hidden ? 1 : 0, 0]), Buffer.from([name.length, 0]), Buffer.from(name, "latin1"));
  const globalsLen = (p1, p2) => Buffer.concat([rec(0x0809, u16(0x0600), u16(0x0005), u32(0), u32(0)), bound(p1, "BoQ1", false), bound(p2, "Sheet2", true), sstRecs, pad ? rec(0x00eb, Buffer.alloc(pad)) : Buffer.alloc(0), rec(0x000a)]);
  const g0 = globalsLen(0, 0).length;
  const globals = globalsLen(g0, g0 + sheet1.length);
  return Buffer.concat([globals, sheet1, sheet2]);
}

// Compound File v3 (512-byte sectors). Small streams (< 4096 bytes) go in the mini stream, as Excel does.
function makeCfb(stream) {
  const END = 0xfffffffe, FREE = 0xffffffff, FATSECT = 0xfffffffd;
  const sec = (b) => { const out = Buffer.alloc(Math.ceil(b.length / 512) * 512 || 512); b.copy(out); return out; };
  const mini = stream.length < 4096;
  const data = sec(stream);                                  // for a mini stream the 64-byte mini sectors are packed in here
  const nData = data.length / 512, nMini = Math.ceil(stream.length / 64);
  const fat = [FATSECT, END, mini ? END : null].filter((x) => x !== null);
  const first = fat.length;                                  // data sectors follow FAT, directory (and mini FAT)
  for (let i = 0; i < nData; i++) fat.push(i === nData - 1 ? END : first + i + 1);
  while (fat.length < 128) fat.push(FREE);
  const dirEntry = (name, type, start, size, child = FREE) => {
    const e = Buffer.alloc(128); Buffer.from(name + "\0", "utf16le").copy(e, 0);
    e.writeUInt16LE((name.length + 1) * 2, 64); e[66] = type; e[67] = 1;
    e.writeUInt32LE(FREE, 68); e.writeUInt32LE(FREE, 72); e.writeUInt32LE(child, 76);
    e.writeUInt32LE(start, 116); e.writeUInt32LE(size, 120); return e;
  };
  const dir = Buffer.concat([
    dirEntry("Root Entry", 5, mini ? first : END, mini ? nMini * 64 : 0, 1),
    dirEntry("Workbook", 2, mini ? 0 : first, stream.length),
    Buffer.alloc(256),
  ]);
  const h = Buffer.alloc(512);
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(h);
  h.writeUInt16LE(0x3e, 24); h.writeUInt16LE(3, 26); h.writeUInt16LE(0xfffe, 28); h.writeUInt16LE(9, 30); h.writeUInt16LE(6, 32);
  h.writeUInt32LE(1, 44); h.writeUInt32LE(1, 48); h.writeUInt32LE(4096, 56);
  h.writeUInt32LE(mini ? 2 : END, 60); h.writeUInt32LE(mini ? 1 : 0, 64); h.writeUInt32LE(END, 68); h.writeUInt32LE(0, 72);
  for (let i = 0; i < 109; i++) h.writeUInt32LE(i === 0 ? 0 : FREE, 76 + i * 4);
  const parts = [h, Buffer.concat(fat.map(u32)), dir];
  if (mini) { const mf = []; for (let i = 0; i < 128; i++) mf.push(i < nMini ? (i === nMini - 1 ? END : i + 1) : FREE); parts.push(Buffer.concat(mf.map(u32))); }
  parts.push(data);
  return Buffer.concat(parts);
}

for (const [label, pad] of [["mini stream", 0], ["regular sectors", 5000]]) {
  test(`reads a BIFF8 .xls (${label}): SST with CONTINUE, LABEL, NUMBER, RK, MULRK, FORMULA + STRING`, () => {
    const sheets = readXls(makeCfb(makeWorkbookStream({ pad })));
    assert.deepEqual(sheets.map((s) => [s.name, s.hidden]), [["BoQ1", false], ["Sheet2", true]]);
    const rows = sheets[0].rows;
    assert.equal(rows[0][0], "Name of Work: Repair of office building");
    assert.equal(rows[1][0], "BIDDER NAME");
    assert.deepEqual(rows[2], ["Sl. No.", "Item Description", "Quantity", "Units", "Estimated Rate", "TOTAL AMOUNT Without Taxes"]);
    assert.deepEqual(rows[3], [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(rows[4], ["", "Civil work"]);
    assert.deepEqual(rows[5], [1, LONG, 12.5, "Cum", 450.5, 5631.25]);
    assert.deepEqual(rows[6], [2, "Painting with acrylic emulsion", 100, "Sqm", "", "", "TRUE"]);
    assert.equal(sheets[1].rows[0][0], "hidden note");
  });
}

test("an .xls BOQ becomes planner items", async () => {
  const { sheet, items } = boqFromSheets(await readWorkbook(makeCfb(makeWorkbookStream())));
  assert.equal(sheet, "BoQ1");
  assert.deepEqual(items, [
    { description: LONG, unit: "Cum", qty: 12.5, rate: 450.5 },
    { description: "Painting with acrylic emulsion", unit: "Sqm", qty: 100, rate: null },
  ]);
  assert.deepEqual(toPlannerItems(items)[1], { item: "Painting with acrylic emulsion", unit: "Sqm", qty: "100", rate: "" });
});

test("refuses what is not an .xls", () => {
  assert.throws(() => readXls(Buffer.from("plain text, not a compound file at all".padEnd(600))), /not an .xls/);
});
