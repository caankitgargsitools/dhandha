// Bank reconciliation (owner, map item 10; 13 Nov): read a bank statement (CSV / Excel from any Indian bank), and match
// money in to open invoices and deposit refunds, money out to EMDs / bank guarantees. Free, no AI. Pure and tested.
import { excelDate } from "./xlsx.js";

const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");

// "05/11/2026", "05-11-26", "5 Nov 2026", "05-Nov-26", "2026-11-05", Excel serial 46331 → "2026-11-05" (Indian day-first)
export function parseDate(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^\d{5}(\.\d+)?$/.test(s)) return excelDate(s);
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ](\d{2,4})/);
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return Number(m[2]) <= 12 ? `${y}-${pad(m[2])}-${pad(m[1])}` : null; }
  m = s.match(/^(\d{1,2})[\/\-. ]([A-Za-z]{3})[A-Za-z]*[\/\-. ,]+(\d{2,4})/);
  if (m && MON[m[2].toLowerCase()]) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${pad(MON[m[2].toLowerCase()])}-${pad(m[1])}`; }
  return null;
}
export function parseAmount(v) {
  const s = String(v ?? "").replace(/[₹,\s]|INR|Rs\.?/gi, "").trim();
  if (!s || s === "-") return 0;
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s);
  const n = Number(s.replace(/[()\-]|(Cr|Dr)$/gi, ""));
  return Number.isFinite(n) ? (neg ? -n : n) : 0;
}

const H = {
  date: /^(txn |transaction |value )?date$|^tran(saction)? date|^date$/i,
  narration: /narration|description|particulars|remarks|details/i,
  ref: /chq|cheque|ref|utr/i,
  debit: /withdraw|debit|dr\.?\s*amount|^dr$/i,
  credit: /deposit|credit|cr\.?\s*amount|^cr$/i,
  amount: /^amount|txn amount|transaction amount/i,
  drcr: /dr\s*\/\s*cr|cr\s*\/\s*dr|^type$/i,
  balance: /balance/i,
};
// the header row may sit below the bank's own preamble (account number, period…)
export function findHeader(rows = []) {
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const cells = rows[i].map((c) => String(c || "").trim());
    const col = {};
    cells.forEach((c, j) => {
      if (!c) return;
      for (const [k, rx] of Object.entries(H)) if (col[k] === undefined && rx.test(c)) { col[k] = j; break; }
    });
    if (col.date !== undefined && col.narration !== undefined && (col.credit !== undefined || col.debit !== undefined || col.amount !== undefined)) return { at: i, col };
  }
  return null;
}

// rows (arrays) → [{txn_date, narration, ref, debit, credit, balance, hash}]
export function parseStatement(rows = []) {
  const h = findHeader(rows);
  if (!h) return { error: "Could not find the Date / Narration / Debit / Credit columns. Download the statement as CSV or Excel from your bank." };
  const { col } = h, out = [];
  for (const r of rows.slice(h.at + 1)) {
    const date = parseDate(r[col.date]);
    if (!date) continue;
    let debit = col.debit !== undefined ? Math.abs(parseAmount(r[col.debit])) : 0;
    let credit = col.credit !== undefined ? Math.abs(parseAmount(r[col.credit])) : 0;
    if (col.amount !== undefined && !debit && !credit) {
      const a = parseAmount(r[col.amount]), t = String(r[col.drcr] ?? r[col.amount] ?? "");
      if (/dr|debit/i.test(t) || a < 0) debit = Math.abs(a); else credit = Math.abs(a);
    }
    if (!debit && !credit) continue;
    const narration = String(r[col.narration] || "").replace(/\s+/g, " ").trim().slice(0, 300);
    const ref = col.ref !== undefined ? String(r[col.ref] || "").trim().slice(0, 60) : "";
    const balance = col.balance !== undefined ? parseAmount(r[col.balance]) : null;
    out.push({ txn_date: date, narration, ref, debit, credit, balance, hash: lineHash({ txn_date: date, narration, ref, debit, credit, balance }) });
  }
  return { lines: out };
}
// the same line in two uploads (overlapping periods) gets the same hash
export function lineHash(l) {
  const s = [l.txn_date, l.narration, l.ref, l.debit, l.credit, l.balance ?? ""].join("|");
  let a = 5381, b = 52711;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = (a * 33) ^ c; b = (b * 33) ^ c; }
  return ((a >>> 0).toString(36) + (b >>> 0).toString(36)).slice(0, 16);
}

const toks = (s) => new Set(String(s || "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 4 && !/^(LTD|LIMITED|PVT|PRIVATE|INDIA|BANK|NEFT|RTGS|IMPS|TRANSFER|FROM|PAYMENT)$/.test(w)));

// best match per line: credits → open invoices (same balance ±₹1; name / number in the narration raise confidence)
// or deposits waiting for a refund; debits → deposits being paid (EMD / BG / fee) of the same amount
export function suggestMatches(lines = [], { invoices = [], deposits = [] } = {}) {
  return lines.map((l) => {
    const cands = [];
    const nar = toks(l.narration), raw = String(l.narration).toUpperCase();
    if (l.credit) {
      for (const inv of invoices) {
        const due = Number(inv.balance);
        if (!(due > 0)) continue;
        const exact = Math.abs(due - l.credit) <= 1, part = l.credit < due;
        if (!exact && !part) continue;
        let score = exact ? 60 : 25;
        const name = [...toks(inv.client_name)].filter((w) => nar.has(w)).length;
        if (name) score += Math.min(30, name * 15);
        if (inv.number && raw.includes(String(inv.number).toUpperCase().replace(/\s/g, ""))) score += 30;
        if (inv.due_date && l.txn_date >= inv.invoice_date) score += 5;
        if (!exact && !name) continue; // a part payment needs the name to be believed
        cands.push({ kind: "invoice", id: inv.id, label: `Invoice ${inv.number || ""} — ${inv.client_name || ""}`, amount: l.credit, score });
      }
      for (const d of deposits) if (d.status === "refund_due" && Math.abs(Number(d.amount) - l.credit) <= 1) cands.push({ kind: "refund", id: d.id, label: `Refund of ${d.kind?.toUpperCase() || "deposit"} — ${d.title || ""}`, amount: l.credit, score: 70 });
    }
    if (l.debit) {
      for (const d of deposits) if (d.status === "held" && Math.abs(Number(d.amount) - l.debit) <= 1 && !d.bank_line_id) {
        const near = d.paid_on ? Math.abs(new Date(d.paid_on) - new Date(l.txn_date)) / 864e5 <= 10 : false;
        cands.push({ kind: "deposit", id: d.id, label: `${d.kind?.toUpperCase() || "Deposit"} paid — ${d.title || ""}`, amount: l.debit, score: near ? 75 : 50 });
      }
    }
    cands.sort((a, b) => b.score - a.score);
    const best = cands[0] || null;
    return { ...l, match: best && best.score >= 50 ? { ...best, sure: best.score >= 80 && !(cands[1] && cands[1].score >= best.score - 10) } : null, others: cands.slice(1, 3) };
  });
}

export function recSummary(lines = []) {
  const s = { lines: lines.length, in: 0, out: 0, matched: 0, unmatched: 0, ignored: 0, toCheck: 0 };
  for (const l of lines) {
    s.in += Number(l.credit) || 0; s.out += Number(l.debit) || 0;
    if (l.status === "matched") s.matched++; else if (l.status === "ignored") s.ignored++; else { s.unmatched++; if (l.match) s.toCheck++; }
  }
  return s;
}
