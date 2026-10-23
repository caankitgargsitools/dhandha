// Annexures as editable forms. A format's filled text (with the AI's [TO BE FILLED: x] blanks) becomes segments:
// text, fields (pre-filled from the masters where known, yellow where not) and tables (partners / staff from Key
// people, experience from Experience). The edited form is stored back as text in which tables are blocks
//   ⟦table Col|Col⟧ row|row … ⟦/table⟧
// so the bid file can print real tables. Pure functions: used by pages, actions, the bid file and `node --test`.
import { classifyBlanks, partnerList, partnerFact, partners, matchFact } from "./masters.js";

const BLANK = /\[TO BE FILLED:\s*([^\]]{2,120})\]/gi;
const TABLE = /⟦table ([^⟧]*)⟧\n?([\s\S]*?)⟦\/table⟧/g;
export const PEOPLE_COLS = ["Name", "Designation", "Qualification", "Membership No.", "Years of experience"];
export const WORKS_COLS = ["Work", "Client", "Value (Rs.)", "Completed on"];
export const personRow = (p) => [p.name || "", p.designation || "", p.qualification || "", p.membership_no || "", p.years_experience != null ? String(p.years_experience) : ""];
export const workRow = (w) => [w.work_name || "", w.client || "", w.value_inr ? String(w.value_inr) : "", w.end_date || ""];
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// Text and table blocks of a stored text.
export function parseBlocks(text) {
  const s = String(text || ""), out = [];
  let last = 0;
  for (const m of s.matchAll(TABLE)) {
    if (m.index > last) out.push({ t: "text", v: s.slice(last, m.index) });
    out.push({ t: "table", cols: m[1].split("|"), rows: m[2].split("\n").filter((l) => l.trim()).map((l) => l.split("|")) });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ t: "text", v: s.slice(last) });
  return out;
}

// Segments for the editor.
export function buildSegments(text, { facts = [], people = [], works = [] } = {}) {
  const out = [];
  const push = (seg) => { const prev = out.at(-1); if (seg.t === "text" && prev?.t === "text") prev.v += seg.v; else out.push(seg); };
  for (const b of parseBlocks(text)) {
    if (b.t === "table") { push({ t: "table", kind: same(b.cols, PEOPLE_COLS) ? "people" : same(b.cols, WORKS_COLS) ? "works" : "other", label: "", cols: b.cols, rows: b.rows }); continue; }
    const blanks = classifyBlanks(b.v);
    let last = 0, i = 0;
    for (const m of b.v.matchAll(BLANK)) {
      if (m.index > last) push({ t: "text", v: b.v.slice(last, m.index) });
      last = m.index + m[0].length;
      const k = blanks[i++];
      if (k.type === "junk") continue;
      if (k.type === "people" || k.type === "works") {
        if (out.some((s) => s.t === "table" && s.kind === k.type)) continue;
        const rows = k.type === "people" ? partners(people).map(personRow) : works.filter((w) => w.status === "completed" || w.status == null).map(workRow);
        push({ t: "table", kind: k.type, label: k.label, cols: k.type === "people" ? PEOPLE_COLS : WORKS_COLS, rows });
        continue;
      }
      if (k.type === "partner") {
        const p = partnerList(people)[k.n - 1];
        const v = p && p[k.field] != null && p[k.field] !== "" ? String(p[k.field]) : partnerFact(k, facts)?.value ?? "";
        push({ t: "field", kind: "partner", n: k.n, field: k.field, label: k.label, value: v, personId: p?.id || null });
        continue;
      }
      push({ t: "field", kind: "fact", label: k.label, value: matchFact(k.label, facts)?.value ?? "" });
    }
    if (last < b.v.length) push({ t: "text", v: b.v.slice(last) });
  }
  return out;
}

const cell = (v) => String(v ?? "").replace(/[|\n⟦⟧]/g, " ").trim();
// The edited form back to stored text; an empty field stays a visible blank.
export function composeText(segments) {
  return segments.map((s) => {
    if (s.t === "text") return s.v;
    if (s.t === "field") return String(s.value || "").trim() || `[TO BE FILLED: ${s.label}]`;
    const rows = s.rows.filter((r) => r.some((c) => String(c).trim()));
    return `\n⟦table ${s.cols.map(cell).join("|")}⟧\n${rows.map((r) => s.cols.map((_, i) => cell(r[i])).join("|")).join("\n")}\n⟦/table⟧\n`;
  }).join("");
}

// How many yellow boxes a form still has.
export const blanksLeft = (segments) => segments.filter((s) => s.t === "field" && !String(s.value || "").trim()).length;
