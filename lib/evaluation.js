// Tender evaluation: the technical marks a bidder can expect, and what that means for the price.
//   L1     lowest price among technically qualified bids wins → the best price is the lowest you can live with.
//   QCBS   final score = T% × (technical marks out of 100) + F% × (100 × lowest price / your price).
// Pure functions: used in the assistant and `node --test`.

const n = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

// The AI's answer, cleaned: method, weights in %, criteria with the marks awarded from the bidder's Vault.
export function normaliseEval(e = {}) {
  const raw = String(e.method || "").toUpperCase();
  const method = /QCBS|QUALITY.*COST|WEIGHT/.test(raw) ? "QCBS" : /QBS/.test(raw) ? "QBS" : /L1|LOWEST|LCS|LEAST/.test(raw) ? "L1" : raw ? "other" : "L1";
  let tw = n(e.tech_weight), fw = n(e.fin_weight);
  if (tw !== null && tw <= 1 && fw !== null && fw <= 1) { tw *= 100; fw *= 100; }
  if (method === "QCBS") { if (tw === null && fw !== null) tw = 100 - fw; if (fw === null && tw !== null) fw = 100 - tw; if (tw === null) { tw = 70; fw = 30; } }
  const criteria = (Array.isArray(e.criteria) ? e.criteria : []).slice(0, 40).map((c) => {
    const max = n(c.max_marks) ?? 0;
    const got = n(c.awarded);
    return { criterion: String(c.criterion || "").slice(0, 200), max, awarded: got === null ? null : Math.max(0, Math.min(max || got, got)), basis: String(c.basis || "").slice(0, 300), raise: String(c.raise || "").slice(0, 300), scoring: String(c.scoring || "").slice(0, 300) };
  }).filter((c) => c.criterion);
  return { method, tech_weight: method === "QCBS" ? tw : null, fin_weight: method === "QCBS" ? fw : null, min_tech: n(e.min_tech_score), formula: String(e.formula || "").slice(0, 300), criteria };
}

// Marks out of the maximum, and as a score out of 100.
export function techTotals(criteria = []) {
  const max = criteria.reduce((s, c) => s + (c.max || 0), 0);
  const got = criteria.reduce((s, c) => s + (c.awarded || 0), 0);
  const unknown = criteria.filter((c) => c.awarded === null).length;
  return { got: round(got), max: round(max), score: max ? round((got / max) * 100) : null, unknown };
}

// QCBS final score for a bidder (technical score out of 100, prices in rupees).
export function qcbsScore({ tech, price, lowest, tw, fw }) {
  if (!price || !lowest) return null;
  const fin = (100 * lowest) / price;
  return { fin: round(fin), final: round((tw * tech) / 100 + (fw * fin) / 100) };
}

// The highest price at which you still beat a rival with the given technical score and price (QCBS).
// Infinity: you win at any price; 0: you cannot win even at a much lower price.
export function maxPriceToBeat({ myTech, rivalTech, rivalPrice, tw, fw }) {
  if (!rivalPrice || !fw) return null;
  const gap = (tw * (myTech - rivalTech)) / fw; // technical lead, in financial points
  if (gap >= 0) return 100 - gap <= 0 ? Infinity : Math.floor((100 * rivalPrice) / (100 - gap)); // you can be dearer
  return Math.max(0, Math.floor(rivalPrice * (1 + gap / 100))); // you must be cheaper
}

// L1: the best price is your cost plus the smallest margin you accept (GST extra), checked against the estimate.
export function l1Advice({ cost, estimate, minMargin = 5 }) {
  if (!cost) return null;
  const price = Math.ceil(cost * (1 + minMargin / 100));
  return { price, belowEstimatePct: estimate ? round(((estimate - price) / estimate) * 100, 1) : null, aboveEstimate: !!(estimate && price > estimate) };
}
