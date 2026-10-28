// Finds the bill of quantities in a spreadsheet's rows and turns it into cost-planner items.
// NIC/GePNIC BOQ sheets carry a few title lines (tender name, "BIDDER NAME"), then a header row such as
// "Sl. No. | Item Description | Quantity | Units | Estimated Rate | TOTAL AMOUNT Without Taxes | …", often a
// row of column numbers and a "TEXT # / NUMBER #" type row, section headings without a quantity, the items, and
// a "Total in Figures" line. Pure functions, tested in tests/boq.test.mjs.

const text = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const num = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  const t = text(v).replace(/[,₹\s]|rs\.?/gi, "");
  return t && /^-?\d*\.?\d+$/.test(t) ? Number(t) : NaN;
};

const IS = {
  desc: /item\s*desc|description|particulars|name of (the )?(item|work)|items? of work|^items?$|^work$/i,
  qty: /^(qty|quantit)|\bqty\b|quantity/i,
  unit: /^(units?|uom|unit of measure\w*)\b/i,
  rate: /\brates?\b/i,
  notRate: /bidder|quoted|to be entered|in words|offered|your/i,
  amount: /amount|\btotal\b/i,
};

// Which column holds what, for one candidate header row (cells already joined across a two-line header).
function columns(cells) {
  const col = {};
  cells.forEach((raw, i) => {
    const c = text(raw);
    if (!c) return;
    if (col.desc === undefined && IS.desc.test(c) && !IS.qty.test(c)) col.desc = i;
    else if (col.qty === undefined && IS.qty.test(c)) col.qty = i;
    else if (col.unit === undefined && IS.unit.test(c) && !IS.rate.test(c)) col.unit = i;
    else if (IS.rate.test(c) && !IS.notRate.test(c) && (col.rate === undefined || /estimat/i.test(c))) col.rate = i;
    else if (IS.amount.test(c) && /estimat/i.test(c) && col.estAmount === undefined) col.estAmount = i;
  });
  return col.desc !== undefined && col.qty !== undefined ? col : null;
}

// Header row (or a header split over two lines) within the first 60 rows.
export function findHeader(rows) {
  const n = Math.min(rows.length, 60);
  const joined = (i) => { const a = rows[i] || [], b = rows[i + 1] || []; return columns(Array.from({ length: Math.max(a.length, b.length) }, (_, k) => `${text(a[k])} ${text(b[k])}`)); };
  for (let i = 0; i < n; i++) {
    const col = columns(rows[i] || []);
    if (!col) continue;
    // the header may go on to a second line ("Estimated" / "Amount (Rs)") when the next row is not an item
    const two = !(num(rows[i + 1]?.[col.qty]) > 0) && joined(i);
    return two && Object.keys(two).length > Object.keys(col).length ? { at: i + 1, col: two } : { at: i, col };
  }
  for (let i = 0; i + 1 < n; i++) { const col = joined(i); if (col) return { at: i + 1, col }; }
  return null;
}

const SKIP = /^(grand\s*)?(sub[\s-]*)?total\b|^total in (figures|words)|^quoted rate|^(text|number)\s*#|^#$/i;

/** boqFromRows(rows) → [{ description, unit, qty, rate }] (rate null when the sheet has no estimated rate). */
export function boqFromRows(rows) {
  const h = findHeader(rows || []);
  if (!h) return [];
  const { col } = h;
  const items = [];
  for (const r of rows.slice(h.at + 1)) {
    if (!r) continue;
    const description = text(r[col.desc]);
    const qty = num(r[col.qty]);
    if (!description || SKIP.test(description)) continue;
    if (!Number.isNaN(num(description))) continue;       // a row of column numbers (1, 2, 3 …)
    if (!(qty > 0)) continue;                             // headings and notes carry no quantity
    let rate = col.rate !== undefined ? num(r[col.rate]) : NaN;
    if (!(rate > 0) && col.estAmount !== undefined && num(r[col.estAmount]) > 0) rate = num(r[col.estAmount]) / qty;
    items.push({ description, unit: col.unit !== undefined ? text(r[col.unit]) : "", qty: Math.round(qty * 1000) / 1000, rate: rate > 0 ? Math.round(rate * 100) / 100 : null });
  }
  return items;
}

/** From every sheet of a workbook, the one that yields the most items (visible sheets first). */
export function boqFromSheets(sheets) {
  let best = { sheet: null, items: [] };
  for (const s of [...(sheets || [])].sort((a, b) => Number(!!a.hidden) - Number(!!b.hidden))) {
    const items = boqFromRows(s.rows);
    if (items.length > best.items.length) best = { sheet: s.name, items };
  }
  return best;
}

/** Items in the cost planner's shape ({ item, unit, qty, rate } as text, like the planner's inputs). */
export const toPlannerItems = (items) => items.map((x) => ({
  item: x.description.length > 400 ? `${x.description.slice(0, 399)}…` : x.description,
  unit: x.unit || "job",
  qty: String(x.qty),
  rate: x.rate ? String(x.rate) : "",
}));
