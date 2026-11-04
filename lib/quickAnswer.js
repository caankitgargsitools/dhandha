// "Ask anything", free first (brief §2.5): a short question about a number or date the reading already has (EMD,
// closing, opening, validity, fee, performance security, value, pre-bid, completion period, turnover, location, MSE
// exemption) is answered from the tender row and the reading at no cost; anything else goes to the paid assistant.
// Pure and tested.

const rs = (n) => `₹${Math.round(Number(n)).toLocaleString("en-IN")}`;
const when = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
const has = (v) => v !== null && v !== undefined && v !== "";

// [key, words that name it, answer(tender, fields) → string | null]
const TOPICS = [
  ["emd", /\b(emd|earnest money|bid security)\b/i, (t, f) => {
    const v = has(t.emd_inr) ? t.emd_inr : f.emd_inr;
    if (!has(v)) return null;
    const ex = f.mse_emd_exempt === true ? " MSEs registered with Udyam are exempt (the tender says so)." : "";
    return Number(v) ? `The EMD is ${rs(v)}.${ex}` : `No EMD is asked for this tender.${ex}`;
  }],
  ["fee", /\b(tender fee|document fee|bid fee|cost of tender|tender cost|processing fee)\b/i, (t, f) => (has(f.tender_fee_inr) ? (Number(f.tender_fee_inr) ? `The tender fee is ${rs(f.tender_fee_inr)}.` : "There is no tender fee.") : null)],
  ["closing", /\b(clos(e|es|ing)|last date|due date|deadline|submission date|submit by|bid end)\b/i, (t, f) => { const d = t.due_at || f.due_at; return d ? `Bids close on ${when(d)} (India time).` : null; }],
  ["opening", /\b(open(ing)? date|bid opening|when .* opened|technical opening)\b/i, (t, f) => { const d = t.opening_at || f.opening_at; return d ? `Bids open on ${when(d)} (India time).` : null; }],
  ["validity", /\b(bid validity|offer validity|valid(ity)? (of|for) (the )?(bid|offer))\b/i, (t, f) => (has(f.bid_validity_days) ? `The bid must stay valid for ${f.bid_validity_days} days.` : null)],
  ["ps", /\b(performance (security|guarantee|bank guarantee)|pbg|epbg|security deposit)\b/i, (t, f) => {
    const p = f.performance_security_pct ?? f.gem?.epbg_pct;
    return has(p) ? `Performance security is ${p}% of the contract value${f.gem?.epbg_months ? `, for ${f.gem.epbg_months} months` : ""}, given on award.` : null;
  }],
  ["value", /\b(estimated (cost|value)|tender value|contract value|estimate|budget)\b/i, (t, f) => { const v = t.value_inr ?? f.value_inr; return has(v) && Number(v) ? `The estimated value is ${rs(v)}.` : null; }],
  ["prebid", /\b(pre[- ]?bid)\b/i, (t, f) => (f.prebid_on ? `The pre-bid meeting is on ${when(f.prebid_on)}.` : null)],
  ["period", /\b(completion period|contract period|duration|how long|time (for|of) completion)\b/i, (t, f) => (f.completion_period ? `Completion period: ${f.completion_period}.` : null)],
  ["turnover", /\b(turnover)\b/i, (t, f) => (has(f.req_avg_turnover) && Number(f.req_avg_turnover) ? `Average annual turnover asked: at least ${rs(f.req_avg_turnover)}${f.turnover_years ? ` over the last ${f.turnover_years} years` : ""}.` : null)],
  ["location", /\b(location|where is the work|site|place of work)\b/i, (t, f) => (f.location ? `Work location: ${f.location}.` : null)],
  ["mse", /\b(msme|mse|udyam).*\b(exempt|exemption|emd)\b|\bexempt(ion)?\b.*\b(msme|mse|udyam)\b/i, (t, f) => (typeof f.mse_emd_exempt === "boolean" ? (f.mse_emd_exempt ? "Yes — MSEs (Udyam) are exempt from the EMD for this tender." : "The tender does not give MSEs an EMD exemption.") : null)],
];

// Only short, plain questions about one thing; "why", "should we", "explain" and the like go to the assistant.
export function quickAnswer(question, tender = {}, fields = {}) {
  const q = String(question || "").trim();
  if (!q || q.split(/\s+/).length > 14 || /\b(why|should|explain|compare|how (do|can|should)|what if|draft|write|meaning)\b/i.test(q)) return null;
  const hits = TOPICS.filter(([, re]) => re.test(q));
  // "mse … emd" names two topics; the specific one wins
  const pick = hits.length === 1 ? hits[0] : hits.find(([k]) => k === "mse") || null;
  if (!pick) return null;
  const a = pick[2](tender || {}, fields || {});
  return a ? { topic: pick[0], answer: `${a} (From the tender's reading — free.)` } : null;
}
