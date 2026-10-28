// Past results library (pure, tested): award-of-contract results from our own crawler, summed up so a bidder sees
// what similar work went for — the usual contract size, how far below the estimate it was won (when the estimate is
// known) and who keeps winning it. Rows come from SQL past_results / similar_awards.

// % below (+) or above (−) the estimate; null when either number is missing
export function discountPct(awarded, estimate) {
  const a = Number(awarded), e = Number(estimate);
  if (!(a > 0) || !(e > 0)) return null;
  return Math.round(((e - a) / e) * 1000) / 10;
}

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function summarise(rows = []) {
  const values = rows.map((r) => Number(r.awarded_value)).filter((v) => v > 0);
  const discounts = rows.map((r) => discountPct(r.awarded_value, r.estimate)).filter((d) => d !== null);
  const firms = new Map();
  for (const r of rows) {
    if (!r.bidder_name) continue;
    const k = r.bidder_name.trim().toLowerCase();
    const f = firms.get(k) || { name: r.bidder_name.trim(), wins: 0, total: 0 };
    f.wins += 1; f.total += Number(r.awarded_value) || 0;
    firms.set(k, f);
  }
  return {
    count: rows.length,
    median: median(values),
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    discount: discounts.length ? { median: median(discounts), known: discounts.length } : null,
    winners: [...firms.values()].sort((a, b) => b.wins - a.wins || b.total - a.total).slice(0, 5),
  };
}

// One plain line for the tender page: "6 similar contracts, usually ₹40–85 lakh, won about 9% below the estimate"
export function adviceLine(sum, fmt = (n) => "₹" + n) {
  if (!sum?.count) return null;
  const parts = [`${sum.count} similar contract${sum.count === 1 ? "" : "s"}`];
  if (sum.min !== null && sum.max !== null) parts.push(sum.min === sum.max ? fmt(sum.min) : `${fmt(sum.min)} to ${fmt(sum.max)} (middle ${fmt(sum.median)})`);
  if (sum.discount) {
    const d = sum.discount.median;
    parts.push(d > 0 ? `won about ${d}% below the estimate` : d < 0 ? `won about ${-d}% above the estimate` : "won at the estimate");
  }
  return parts.join(", ");
}
