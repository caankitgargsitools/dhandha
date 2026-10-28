// Opens a spreadsheet in the browser (or Node 18+): old .xls via lib/xls.js, .xlsx via a small async unzip
// that uses the platform's DecompressionStream. Returns every sheet: [{ name, hidden, rows }].
// (lib/xlsx.js does the same for one sheet on the server, but it needs node:zlib and is copied on its own into
// the crawler image, so it stays as it is.)
import { readXls } from "./xls.js";

const utf8 = new TextDecoder();
const unxml = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, "&");
const colIndex = (ref) => { let n = 0; for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

async function inflate(raw) {
  const out = new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw")));
  return new Uint8Array(await out.arrayBuffer());
}

// The zip's central directory → { name: async () => text }.
function unzip(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not an .xlsx file");
  const files = {};
  for (let n = 0, p = dv.getUint32(eocd + 16, true), count = dv.getUint16(eocd + 10, true); n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("damaged .xlsx file");
    const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true), nameLen = dv.getUint16(p + 28, true);
    const local = dv.getUint32(p + 42, true);
    const name = utf8.decode(u8.subarray(p + 46, p + 46 + nameLen));
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const raw = u8.subarray(start, start + size);
    files[name] = async () => utf8.decode(method === 8 ? await inflate(raw) : raw);
    p += 46 + nameLen + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
  }
  return files;
}

async function readXlsxSheets(u8, maxRows) {
  const files = unzip(u8);
  const shared = files["xl/sharedStrings.xml"] ? ((await files["xl/sharedStrings.xml"]()).match(/<si>[\s\S]*?<\/si>/g) || [])
    .map((si) => unxml((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map((t) => t.replace(/<t[^>]*>|<\/t>/g, "")).join(""))) : [];
  // sheets in workbook order, through the relationship ids; fall back to sheetN.xml files
  let list = [];
  if (files["xl/workbook.xml"] && files["xl/_rels/workbook.xml.rels"]) {
    const rels = Object.fromEntries([...(await files["xl/_rels/workbook.xml.rels"]()).matchAll(/<Relationship\b[^>]*>/g)]
      .map(([r]) => [(r.match(/\bId="([^"]+)"/) || [])[1], (r.match(/\bTarget="([^"]+)"/) || [])[1]]));
    list = [...(await files["xl/workbook.xml"]()).matchAll(/<sheet\b[^>]*>/g)].map(([s]) => {
      const t = rels[(s.match(/\br:id="([^"]+)"/) || [])[1]] || "";
      return { name: unxml((s.match(/\bname="([^"]*)"/) || [])[1] || ""), hidden: /\bstate="(hidden|veryHidden)"/.test(s), path: t.startsWith("/") ? t.slice(1) : `xl/${t}` };
    }).filter((x) => files[x.path]);
  }
  if (!list.length) list = Object.keys(files).filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort((a, b) => parseInt(a.slice(19)) - parseInt(b.slice(19))).map((path, i) => ({ name: `Sheet${i + 1}`, hidden: false, path }));
  if (!list.length) throw new Error("the workbook has no sheets");
  const out = [];
  for (const sh of list) {
    const rows = [];
    for (const row of (await files[sh.path]()).match(/<row[^>]*>[\s\S]*?<\/row>|<row[^>]*\/>/g) || []) {
      if (rows.length >= maxRows) break;
      const r = [];
      for (const c of row.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []) {
        const ref = (c.match(/ r="([A-Z]+\d+)"/) || [])[1], type = (c.match(/ t="(\w+)"/) || [])[1];
        let v = (c.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        if (type === "s") v = shared[Number(v)];
        else if (type === "inlineStr") v = unxml((c.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1] || "");
        else if (v !== undefined && (type === "str" || type === "b" || type === "e")) v = unxml(v);
        else if (v !== undefined) v = Number(v);
        const i = ref ? colIndex(ref) : r.length;
        while (r.length < i) r.push("");
        r[i] = v ?? "";
      }
      if (r.some((x) => String(x).trim() !== "")) rows.push(r);
    }
    out.push({ name: sh.name, hidden: sh.hidden, rows });
  }
  return out;
}

/** readWorkbook(bytes) → [{ name, hidden, rows }]; the format is told by the file's first bytes, not its name. */
export async function readWorkbook(input, { maxRows = 20000 } = {}) {
  const u8 = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (u8[0] === 0xd0 && u8[1] === 0xcf) return readXls(u8, { maxRows });
  if (u8[0] === 0x50 && u8[1] === 0x4b) return readXlsxSheets(u8, maxRows);
  throw new Error("this is not an Excel file (.xls or .xlsx)");
}
