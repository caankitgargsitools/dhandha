// Reads an old-format Excel file (.xls, BIFF8 — what GePNIC portals publish as "BOQ_<id>.xls") into sheets of
// rows. No dependencies and no Node APIs, so it runs in the browser as well as on the server.
//
// An .xls is a Compound File (OLE2): a little FAT file system of fixed-size sectors. Inside it the "Workbook"
// (or "Book") stream is a run of BIFF records: [type u16][length u16][data]. The workbook globals come first
// (BOUNDSHEET = sheet names and where each sheet starts, SST = the shared strings), then one substream per
// sheet whose cell records (LABELSST, LABEL, NUMBER, RK, MULRK, FORMULA (+STRING), BOOLERR) we place by row/col.
// Sheet protection does not stop reading; a file with an open password (FILEPASS) is encrypted and refused.

const END = 0xfffffffe, FREE = 0xffffffff;
const utf16 = new TextDecoder("utf-16le"), latin1 = new TextDecoder("latin1");

// ---- Compound File Binary container ----
function cfbStream(u8, wanted) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const sig = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  if (u8.length < 512 || sig.some((b, i) => u8[i] !== b)) throw new Error("not an .xls file");
  const ssz = 1 << dv.getUint16(0x1e, true), mssz = 1 << dv.getUint16(0x20, true);
  const cutoff = dv.getUint32(0x38, true);
  // sector n starts right after the header, which fills sector "-1" (512 bytes in v3, padded to 4096 in v4)
  const sector = (sec) => u8.subarray((sec + 1) * ssz, (sec + 2) * ssz);

  // DIFAT: the first 109 FAT sector numbers sit in the header, the rest in a chain of DIFAT sectors.
  const fatSectors = [];
  for (let i = 0; i < 109; i++) fatSectors.push(dv.getUint32(0x4c + i * 4, true));
  for (let d = dv.getUint32(0x44, true), n = dv.getUint32(0x48, true); n-- > 0 && d < END;) {
    const s = sector(d), sv = new DataView(s.buffer, s.byteOffset, ssz);
    for (let i = 0; i < ssz / 4 - 1; i++) fatSectors.push(sv.getUint32(i * 4, true));
    d = sv.getUint32(ssz - 4, true);
  }
  const fat = [];
  for (const f of fatSectors.slice(0, dv.getUint32(0x2c, true))) {
    if (f >= END) continue;
    const s = sector(f), sv = new DataView(s.buffer, s.byteOffset, ssz);
    for (let i = 0; i < ssz / 4; i++) fat.push(sv.getUint32(i * 4, true));
  }
  // Follows a sector chain and joins the sectors (bounded, so a looping chain cannot hang us).
  const chain = (start, table, read, size) => {
    const parts = [];
    for (let s = start, guard = 0; s < END && s !== FREE && guard < table.length + 1; s = table[s], guard++) parts.push(read(s));
    const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
    let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
    return size === undefined ? out : out.subarray(0, size);
  };
  const dir = chain(dv.getUint32(0x30, true), fat, sector);
  const entries = [];
  for (let o = 0; o + 128 <= dir.length; o += 128) {
    const ev = new DataView(dir.buffer, dir.byteOffset + o, 128);
    const nameLen = ev.getUint16(64, true);
    entries.push({ name: utf16.decode(dir.subarray(o, o + Math.max(0, nameLen - 2))), type: dir[o + 66], start: ev.getUint32(116, true), size: ev.getUint32(120, true) });
  }
  const root = entries[0];
  const e = entries.find((x) => x.type === 2 && wanted.includes(x.name.toLowerCase()));
  if (!e) throw new Error("this .xls has no workbook inside");
  if (e.size >= cutoff) return chain(e.start, fat, sector, e.size);
  // small streams live in the mini stream (the root entry's chain), cut into 64-byte mini sectors
  const mini = chain(root.start, fat, sector);
  const mfatRaw = chain(dv.getUint32(0x3c, true), fat, sector), mv = new DataView(mfatRaw.buffer, mfatRaw.byteOffset, mfatRaw.length);
  const mfat = Array.from({ length: mfatRaw.length / 4 }, (_, i) => mv.getUint32(i * 4, true));
  return chain(e.start, mfat, (s) => mini.subarray(s * mssz, (s + 1) * mssz), e.size);
}

// ---- BIFF8 helpers ----
// RK: a compressed number. Bit 0 = divide by 100; bit 1 = 30-bit signed integer, else the top 30 bits of a double.
function rk(v) {
  let n;
  if (v & 2) n = v >> 2;
  else { const b = new DataView(new ArrayBuffer(8)); b.setUint32(4, v & 0xfffffffc, true); n = b.getFloat64(0, true); }
  return v & 1 ? n / 100 : n;
}
// XLUnicodeString inside one record: cch (u8 or u16), flags (bit 0 = UTF-16), then the characters.
function str(u8, o, wide = true) {
  const cch = wide ? u8[o] | (u8[o + 1] << 8) : u8[o];
  o += wide ? 2 : 1;
  const flags = u8[o++];
  const n = flags & 1 ? cch * 2 : cch;
  return (flags & 1 ? utf16 : latin1).decode(u8.subarray(o, o + n));
}

// The SST record and its CONTINUE records are read as one, but a string's characters that run into a CONTINUE
// start again with a fresh flags byte (they may switch between 8-bit and UTF-16 there).
function readSst(chunks) {
  let ci = 0, p = 0;
  const left = () => chunks[ci].length - p;
  const next = () => { ci++; p = 0; if (ci >= chunks.length) throw new Error("short SST"); };
  const bytes = (n) => { const out = []; while (n > 0) { if (!left()) next(); const k = Math.min(n, left()); out.push(...chunks[ci].subarray(p, p + k)); p += k; n -= k; } return out; };
  const u16 = () => { const b = bytes(2); return b[0] | (b[1] << 8); };
  const u32 = () => { const b = bytes(4); return (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0; };
  u32(); const unique = u32();
  const out = [];
  try {
    for (let i = 0; i < unique; i++) {
      const cch = u16(), flags = bytes(1)[0];
      let wide = flags & 1, s = "";
      const runs = flags & 8 ? u16() : 0, ext = flags & 4 ? u32() : 0;
      for (let rem = cch; rem > 0;) {
        if (!left()) { next(); wide = chunks[ci][p++] & 1; }
        const k = Math.min(rem, Math.floor(left() / (wide ? 2 : 1)));
        s += (wide ? utf16 : latin1).decode(chunks[ci].subarray(p, p + k * (wide ? 2 : 1)));
        p += k * (wide ? 2 : 1); rem -= k;
      }
      bytes(runs * 4 + ext); // rich-text runs and phonetic data: not needed
      out.push(s);
    }
  } catch { /* a damaged tail: keep the strings read so far */ }
  return out;
}

/**
 * readXls(bytes, { maxRows }) → [{ name, hidden, rows: [[value, …], …] }] in workbook order.
 * Values are strings or numbers (booleans as TRUE/FALSE, errors as ""); blank rows are dropped, like readXlsx.
 */
export function readXls(input, { maxRows = 20000 } = {}) {
  const u8 = input instanceof Uint8Array ? input : new Uint8Array(input);
  const wb = cfbStream(u8, ["workbook", "book"]);
  const dv = new DataView(wb.buffer, wb.byteOffset, wb.byteLength);
  const sheets = [], byPos = new Map();
  let sst = [], sstChunks = null, cur = null, depth = 0, pendingString = null;
  const put = (row, col, v) => {
    if (!cur || depth !== 1 || row >= maxRows) return;
    const r = (cur.cells[row] ||= []);
    r[col] = v;
  };
  for (let o = 0; o + 4 <= wb.length;) {
    const type = dv.getUint16(o, true), len = dv.getUint16(o + 2, true), d = o + 4;
    const rec = wb.subarray(d, d + len);
    const u16 = (k) => dv.getUint16(d + k, true);
    if (sstChunks && type !== 0x003c) { sst = readSst(sstChunks); sstChunks = null; }
    switch (type) {
      case 0x0809: // BOF: globals, a worksheet, or a chart nested inside a sheet
        if (depth === 0 && byPos.has(o)) cur = byPos.get(o);
        if (depth === 0 && u16(0) !== 0x0600) throw new Error("this .xls is an old Excel 95 file; open it in Excel and save it again");
        depth++; break;
      case 0x000a: if (--depth === 0) cur = null; break; // EOF
      case 0x002f: throw new Error("this .xls is password-protected; open it in Excel and save it as .xlsx without a password");
      case 0x0085: { // BOUNDSHEET: stream position, visibility, sheet type, name
        const s = { name: str(rec, 6, false), hidden: (rec[4] & 3) !== 0, kind: rec[5], cells: [] };
        sheets.push(s); byPos.set(dv.getUint32(d, true), s); break;
      }
      case 0x00fc: sstChunks = [rec]; break; // SST
      case 0x003c: if (sstChunks) sstChunks.push(rec); break; // CONTINUE
      case 0x00fd: put(u16(0), u16(2), sst[dv.getUint32(d + 6, true)] ?? ""); break; // LABELSST
      case 0x0204: case 0x00d6: put(u16(0), u16(2), str(rec, 6)); break; // LABEL / RSTRING
      case 0x0203: put(u16(0), u16(2), dv.getFloat64(d + 6, true)); break; // NUMBER
      case 0x027e: put(u16(0), u16(2), rk(dv.getUint32(d + 6, true))); break; // RK
      case 0x00bd: { // MULRK: row, first col, (xf, rk)×n, last col
        const row = u16(0), first = u16(2);
        for (let i = 0; 6 + i * 6 + 6 <= len; i++) put(row, first + i, rk(dv.getUint32(d + 4 + i * 6 + 2, true)));
        break;
      }
      case 0x0006: { // FORMULA: the cached result — a number, or a marker (0xFFFF in the top bytes) for string/bool/error
        const row = u16(0), col = u16(2);
        if (u16(12) !== 0xffff) put(row, col, dv.getFloat64(d + 6, true));
        else if (rec[6] === 0) pendingString = [row, col]; // the text follows in a STRING record
        else if (rec[6] === 1) put(row, col, rec[8] ? "TRUE" : "FALSE");
        else put(row, col, "");
        break;
      }
      case 0x0207: if (pendingString) { put(...pendingString, str(rec, 0)); pendingString = null; } break; // STRING
      case 0x0205: put(u16(0), u16(2), rec[7] ? "" : rec[6] ? "TRUE" : "FALSE"); break; // BOOLERR
    }
    o = d + len;
  }
  return sheets.filter((s) => s.kind === 0).map((s) => ({
    name: s.name, hidden: s.hidden,
    rows: s.cells.filter((r) => r && r.some((v) => v !== undefined && String(v).trim() !== ""))
      .map((r) => Array.from(r, (v) => (v === undefined ? "" : v))),
  }));
}
