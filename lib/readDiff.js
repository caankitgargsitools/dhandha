// Corrigendum re-read (brief §3.5): what changed between two readings of the same tender — numbers, dates, formats and
// documents asked for — and which parts of the bid need another look. Pure and tested.

const FIELDS = [
  ["due_at", "Closing", "date"], ["opening_at", "Opening", "date"], ["prebid_on", "Pre-bid meeting", "date"],
  ["emd_inr", "EMD", "money"], ["value_inr", "Estimated value", "money"], ["tender_fee_inr", "Tender fee", "money"],
  ["req_avg_turnover", "Turnover asked", "money"], ["req_similar_one", "Similar work (one)", "money"],
  ["req_similar_two", "Similar work (two)", "money"], ["req_similar_three", "Similar work (three)", "money"],
  ["bid_validity_days", "Bid validity (days)", "num"], ["performance_security_pct", "Performance security %", "num"], ["completion_period", "Completion period", "text"],
];
const show = (v, kind) => (v == null || v === "" ? "—" : kind === "money" ? `₹${Math.round(Number(v)).toLocaleString("en-IN")}` : kind === "date" ? new Date(v).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : String(v));
const same = (a, b, kind) => (kind === "date" ? (a && b ? Math.abs(new Date(a) - new Date(b)) < 60000 : !a === !b) : String(a ?? "") === String(b ?? ""));

// older / newer: tender_reads rows {fields, formats, required_docs}
export function readDiff(older = {}, newer = {}) {
  const a = older.fields || {}, b = newer.fields || {};
  const changes = [];
  for (const [k, label, kind] of FIELDS) {
    if (b[k] == null || b[k] === "") continue; // the new reading says nothing: not a change
    if (!same(a[k], b[k], kind)) changes.push({ key: k, label, from: show(a[k], kind), to: show(b[k], kind) });
  }
  const titles = (r) => new Set((r.formats || []).map((f) => String(f.title || "").trim().toLowerCase()).filter(Boolean));
  const fa = titles(older), fb = titles(newer);
  const formatsAdded = [...fb].filter((x) => !fa.has(x)), formatsGone = [...fa].filter((x) => !fb.has(x));
  const da = new Set(older.required_docs || []), db = new Set(newer.required_docs || []);
  const docsAdded = [...db].filter((x) => !da.has(x));
  const recheck = [];
  if (changes.some((c) => ["emd_inr", "value_inr", "performance_security_pct", "completion_period"].includes(c.key))) recheck.push("price");
  if (formatsAdded.length || formatsGone.length) recheck.push("formats");
  if (changes.some((c) => c.key.startsWith("req_")) || docsAdded.length) recheck.push("eligibility");
  if (changes.some((c) => c.key === "due_at" || c.key === "prebid_on")) recheck.push("bid plan");
  return { changes, formatsAdded, formatsGone, docsAdded, recheck, any: !!(changes.length || formatsAdded.length || formatsGone.length || docsAdded.length) };
}
