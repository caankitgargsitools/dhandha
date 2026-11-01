// A format's text ↔ Google Docs / Word / Google Sheets / Excel (pure, tested). Formats are plain text with
// [TO BE FILLED: label] boxes and table blocks "⟦table A|B⟧\nrow|row\n⟦/table⟧". Out: HTML a document editor opens
// (boxes highlighted yellow, tables as real tables) or CSV a spreadsheet opens (the tables only). Back: the HTML Google
// Docs exports, a .docx's document.xml, or the CSV / sheet rows → the same text, so the bid file and the annexure
// form keep working.

// Largest filled file taken back (server actions accept at most 4 MB — next.config.js bodySizeLimit).
export const MAX_UPLOAD = 3.5 * 1024 * 1024;

const escHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unHtml = (s) => String(s).replace(/&nbsp;|&#160;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;|&#x27;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, "&");

// Splits a format's text into text and table blocks.
export function blocks(text) {
  const out = [];
  const re = /⟦table ([^⟧]*)⟧\n?([\s\S]*?)⟦\/table⟧\n?/g;
  let at = 0, m;
  const s = String(text || "");
  while ((m = re.exec(s))) {
    if (m.index > at) out.push({ kind: "text", text: s.slice(at, m.index) });
    out.push({ kind: "table", cols: m[1].split("|").map((c) => c.trim()), rows: m[2].split("\n").filter((l) => l.trim() !== "").map((l) => l.split("|").map((c) => c.trim())) });
    at = re.lastIndex;
  }
  if (at < s.length) out.push({ kind: "text", text: s.slice(at) });
  return out;
}
const cellText = (c) => String(c ?? "").replace(/[|\n⟦⟧]/g, " ").replace(/\s+/g, " ").trim();
export const tableText = (cols, rows) => `⟦table ${cols.map(cellText).join("|")}⟧\n${rows.map((r) => cols.map((_, i) => cellText(r[i])).join("|")).join("\n")}\n⟦/table⟧\n`;

const markBoxes = (s) => escHtml(s).replace(/\[TO BE FILLED: ([^\]]+)\]/g, '<span style="background:#fff3a3">[TO BE FILLED: $1]</span>');

// HTML for Google Docs (uploaded with conversion) and for Word (saved as .doc, which Word opens and edits).
export function toDocHtml(text, { title = "", word = false } = {}) {
  const body = blocks(text).map((b) => b.kind === "text"
    ? b.text.split("\n").map((l) => (l.trim() ? `<p>${markBoxes(l)}</p>` : "<p>&nbsp;</p>")).join("\n")
    : `<table border="1" cellpadding="4" style="border-collapse:collapse;width:100%"><tr>${b.cols.map((c) => `<th style="background:#eef">${escHtml(c)}</th>`).join("")}</tr>${(b.rows.length ? b.rows : [b.cols.map(() => "")]).map((r) => `<tr>${b.cols.map((_, i) => `<td>${markBoxes(r[i] ?? "")}</td>`).join("")}</tr>`).join("")}</table>`).join("\n");
  const head = `<meta charset="utf-8"><title>${escHtml(title)}</title><style>body{font-family:Arial,sans-serif;font-size:11pt} p{margin:0 0 4pt}</style>`;
  return word
    ? `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head>${head}</head><body>${body}</body></html>`
    : `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
}

// Google Docs' HTML export (or any HTML) → format text.
export function fromDocHtml(html) {
  // whitespace in HTML source is one space (Word wraps its saved HTML mid-sentence and between tags); lines come only from tags
  let s = String(html || "").replace(/\s+/g, " ").replace(/<head[\s\S]*?<\/head>/i, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "");
  // a cell with several paragraphs keeps a space between them
  const lineOf = (frag) => unHtml(frag.replace(/<br\s*\/?>|<\/(p|div|li|h[1-6])>/gi, " ").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
  // tables first: header row → columns, the rest → rows
  s = s.replace(/<table[\s\S]*?<\/table>/gi, (t) => {
    const rows = [...t.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((r) => [...r[0].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => lineOf(c[1])));
    if (!rows.length) return "";
    const [cols, ...rest] = rows;
    return `\u0000${tableText(cols, rest.filter((r) => r.some((c) => c)))}\u0000`;
  });
  s = s.replace(/<\/(p|div|h[1-6]|li)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<li[^>]*>/gi, "• ");
  const parts = s.split("\u0000");
  return parts.map((p, i) => (i % 2 ? p : unHtml(p.replace(/<[^>]+>/g, "")).split("\n").map((l) => l.replace(/[ \t ]+/g, " ").trim()).join("\n")))
    .join("").replace(/\n{3,}/g, "\n\n").trim();
}

// A Word .docx's word/document.xml → format text (paragraphs and tables).
export function fromDocxXml(xml) {
  const un = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  const para = (p) => un((p.match(/<w:t(?:\s[^>]*)?>[^<]*<\/w:t>|<w:tab\/>|<w:br\/>/g) || []).map((x) => (x === "<w:tab/>" ? "\t" : x === "<w:br/>" ? "\n" : x.replace(/<[^>]+>/g, ""))).join(""));
  // a section break (<w:sectPr> inside a paragraph) is not the end; only </w:body> is
  const body = String(xml || "").replace(/^[\s\S]*?<w:body>/, "").replace(/<\/w:body>[\s\S]*$/, "");
  const out = [];
  const re = /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g;
  let m;
  while ((m = re.exec(body))) {
    const x = m[0];
    if (x.startsWith("<w:tbl>")) {
      const rows = [...x.matchAll(/<w:tr[ >][\s\S]*?<\/w:tr>/g)].map((r) => [...r[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((c) => [...c[0].matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((p) => para(p[0])).join(" ").trim()));
      if (rows.length) { const [cols, ...rest] = rows; out.push(tableText(cols, rest.filter((r) => r.some((c) => c))).trimEnd()); }
    } else out.push(x === "<w:p/>" ? "" : para(x));
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// The tables only, for a spreadsheet: each table's header row then its rows, tables separated by an empty row.
const csvCell = (c) => { const v = String(c ?? ""); const safe = /^[=+\-@]/.test(v) ? `'${v}` : v; return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe; };
export function toCsv(text) {
  return blocks(text).filter((b) => b.kind === "table").map((b) => [b.cols, ...(b.rows.length ? b.rows : [b.cols.map(() => "")])].map((r) => b.cols.map((_, i) => csvCell(r[i])).join(",")).join("\n")).join("\n\n") + "\n";
}
export function parseCsv(csv) {
  const rows = []; let row = [], cell = "", q = false;
  const s = String(csv || "").replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && s[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.replace(/^'(?=[=+\-@])/, "")));
}
// Sheet rows back into the format: the i-th group of rows (between empty rows) replaces the i-th table.
export function withSheetTables(text, sheetRows) {
  const groups = [];
  let cur = [];
  // Google's CSV export pads every row to the sheet's widest table: trailing empty cells are not columns
  const trimEnd = (r) => { let n = r.length; while (n && !String(r[n - 1] ?? "").trim()) n--; return r.slice(0, n); };
  for (const r of (sheetRows || []).map(trimEnd)) {
    if (!r.length) { if (cur.length) groups.push(cur); cur = []; } else cur.push(r);
  }
  if (cur.length) groups.push(cur);
  let i = 0;
  const out = blocks(text).map((b) => {
    if (b.kind !== "table") return b.text;
    const g = groups[i++];
    if (!g) return tableText(b.cols, b.rows);
    const [cols, ...rest] = g;
    const width = Math.max(b.cols.length, ...g.map((r) => r.length));
    const head = Array.from({ length: width }, (_, k) => cellText(cols[k]) || b.cols[k] || `Column ${k + 1}`);
    return tableText(head, rest);
  });
  return out.join("");
}

export const hasTables = (text) => /⟦table /.test(String(text || ""));
// tables carry most of it → a spreadsheet is the easier place to fill it
export function prefersSheet(text) {
  const bs = blocks(text);
  const rows = bs.filter((b) => b.kind === "table").reduce((n, b) => n + b.rows.length + 1, 0);
  const lines = bs.filter((b) => b.kind === "text").reduce((n, b) => n + b.text.split("\n").filter((l) => l.trim()).length, 0);
  return rows > 0 && rows >= lines;
}
