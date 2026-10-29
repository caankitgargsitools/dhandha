// Your record on tenders like this (pure, tested; learned from the firm's own bid results, C37): how many bids it won
// with this department, in this state, in this kind of work and size band — and, with enough decided bids, a combined
// estimate (naive Bayes, damped like lib/winChance.js). Rows: SQL bid_outcomes (status won / lost decide a bid).

export const MIN_DECIDED = 8;
const band = (v) => { const n = Number(v) || 0; return !n ? null : n < 1e6 ? "under ₹10 lakh" : n < 1e7 ? "₹10 lakh–1 crore" : n < 1e8 ? "₹1–10 crore" : "over ₹10 crore"; };
const feats = (t) => [["authority", "this department", t.authority], ["state", "this state", t.state], ["industry_pack", "this kind of work", t.industry_pack], ["band", "this size", band(t.value_inr ?? t.estimate)]].filter(([, , v]) => v);

export function bidChance(rows = [], tender = {}) {
  const decided = rows.filter((r) => r.status === "won" || r.status === "lost").map((r) => ({ ...r, band: band(r.estimate) }));
  const W = decided.filter((r) => r.status === "won").length, L = decided.length - W;
  const records = feats(tender).map(([key, label, value]) => {
    const same = decided.filter((r) => r[key] === value);
    const won = same.filter((r) => r.status === "won").length;
    return { key, label, value, bids: same.length, won };
  }).filter((r) => r.bids > 0);
  let p = null;
  if (decided.length >= MIN_DECIDED) {
    let z = Math.log((W + 1) / (L + 1));
    for (const r of records) {
      if (r.bids < 2) continue;
      z += 0.7 * (Math.log((r.won + 1) / (W + 2)) - Math.log((r.bids - r.won + 1) / (L + 2)));
    }
    p = Math.round(Math.min(0.95, Math.max(0.02, 1 / (1 + Math.exp(-z)))) * 100);
  }
  return { decided: decided.length, won: W, p, records };
}
