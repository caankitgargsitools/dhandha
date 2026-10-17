// Reads the first sheet of an .xlsx file into rows of strings. No dependencies: an .xlsx is a zip of XML,
// so this walks the zip's central directory, inflates the two parts it needs and reads cells by reference.
import { inflateRawSync } from "node:zlib";

function unzip(buf) {
  const files = {};
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not an .xlsx file");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("damaged .xlsx file");
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    files[name] = () => { const raw = buf.subarray(start, start + size); return (method === 8 ? inflateRawSync(raw) : raw).toString("utf8"); };
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const unxml = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, "&");
const colIndex = (ref) => { let n = 0; for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

export function readXlsx(input, { maxRows = 20000 } = {}) {
  const files = unzip(Buffer.from(input));
  const shared = [];
  if (files["xl/sharedStrings.xml"]) {
    for (const si of files["xl/sharedStrings.xml"]().match(/<si>[\s\S]*?<\/si>/g) || []) {
      shared.push(unxml((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map((t) => t.replace(/<t[^>]*>|<\/t>/g, "")).join("")));
    }
  }
  // first sheet in workbook order
  let sheet = "xl/worksheets/sheet1.xml";
  if (!files[sheet]) sheet = Object.keys(files).filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort()[0];
  if (!sheet) throw new Error("the workbook has no sheets");
  const rows = [];
  for (const row of files[sheet]().match(/<row[^>]*>[\s\S]*?<\/row>|<row[^>]*\/>/g) || []) {
    if (rows.length >= maxRows) break;
    const out = [];
    for (const c of row.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []) {
      const ref = (c.match(/ r="([A-Z]+\d+)"/) || [])[1];
      const type = (c.match(/ t="(\w+)"/) || [])[1];
      let v = (c.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      if (type === "s") v = shared[Number(v)];
      else if (type === "inlineStr") v = unxml((c.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1] || "");
      else if (v !== undefined) v = unxml(v);
      const i = ref ? colIndex(ref) : out.length;
      while (out.length < i) out.push("");
      out[i] = v ?? "";
    }
    if (out.some((x) => String(x).trim() !== "")) rows.push(out.map(String));
  }
  return rows;
}

// Excel stores dates as days since 1899-12-30.
export const excelDate = (n) => new Date(Date.UTC(1899, 11, 30) + Math.round(Number(n)) * 864e5).toISOString().slice(0, 10);
