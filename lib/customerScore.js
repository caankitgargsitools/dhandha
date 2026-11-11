// Customer score (owner, 11 Nov, map item 6): how healthy each won customer is, 0–100, from what Dhandha already knows —
// how recently they bought, how often, how much, whether they pay on time, how often you talk, and whether they
// refer or review. Pure and tested.

const DAY = 86400000;
const days = (d, now) => (d ? Math.max(0, Math.round((now - new Date(d)) / DAY)) : null);

// c: a row of SQL customer_health → { score, band, parts: [{label, pts, max}], flags: [text], next }
export function customerScore(c = {}, now = new Date()) {
  const sinceWin = days(c.last_won, now), sinceTouch = days(c.last_touch, now);
  const parts = [];
  // recency of buying (25)
  const rec = sinceWin == null ? 0 : sinceWin <= 90 ? 25 : sinceWin <= 180 ? 18 : sinceWin <= 365 ? 10 : 3;
  parts.push({ label: "Bought recently", pts: rec, max: 25 });
  // frequency (15): repeat business
  const freq = Math.min(15, (Number(c.won_deals) || 0) * 5 + (Number(c.open_deals) > 0 ? 3 : 0));
  parts.push({ label: "Buys again", pts: freq, max: 15 });
  // value (15): log scale, ₹10 lakh+ = full
  const v = Number(c.won_value) || 0;
  const val = v <= 0 ? 0 : Math.min(15, Math.round((Math.log10(v) - 3) * 3.75));
  parts.push({ label: "Business value", pts: Math.max(0, val), max: 15 });
  // pays on time (20)
  const pay = Number(c.overdue_count) > 0 ? Math.max(0, 8 - Number(c.overdue_count) * 4) : Number(c.late_paid) > 0 ? 14 : 20;
  parts.push({ label: "Pays on time", pts: pay, max: 20 });
  // in touch (15)
  const touch = sinceTouch == null ? 0 : sinceTouch <= 30 ? 15 : sinceTouch <= 60 ? 10 : sinceTouch <= 120 ? 5 : 0;
  parts.push({ label: "In touch", pts: touch, max: 15 });
  // advocate (10)
  const adv = Math.min(10, (Number(c.referrals) || 0) * 5 + (c.review_clicked ? 5 : 0));
  parts.push({ label: "Refers / reviews", pts: adv, max: 10 });
  let score = parts.reduce((a, p) => a + p.pts, 0);
  if (Number(c.lost_after_win) > 0) score = Math.max(0, score - 10);
  const band = score >= 70 ? "healthy" : score >= 45 ? "watch" : "at_risk";

  const flags = [];
  if (Number(c.overdue) > 0) flags.push(`₹${Math.round(Number(c.overdue)).toLocaleString("en-IN")} overdue`);
  if (sinceTouch != null && sinceTouch > 60) flags.push(`No contact for ${sinceTouch} days`);
  if (sinceTouch == null) flags.push("Never contacted after the win");
  if (Number(c.lost_after_win) > 0) flags.push("Lost a deal after the first win");
  const renew = c.renews_on ? days(now, new Date(c.renews_on)) : null;
  if (renew != null && renew <= 45) flags.push(`Renews in ${renew} days`);

  const next = Number(c.overdue) > 0 ? "Chase the overdue payment"
    : renew != null && renew <= 45 ? "Talk about the renewal"
    : sinceTouch == null || sinceTouch > 60 ? "Call to check in"
    : !c.review_clicked && score >= 60 ? "Ask for a Google review"
    : !(Number(c.referrals) > 0) && score >= 70 ? "Ask for a referral"
    : Number(c.won_deals) === 1 && sinceWin != null && sinceWin > 120 ? "Offer the next job"
    : null;
  return { score, band, parts, flags, next };
}

export const BANDS = { healthy: ["Healthy", "ok"], watch: ["Watch", "warn"], at_risk: ["At risk", "bad"] };

// list summary: counts per band and the money with customers at risk
export function healthSummary(rows = []) {
  const out = { healthy: 0, watch: 0, at_risk: 0, total: rows.length, riskValue: 0, avg: 0 };
  for (const r of rows) { out[r.h.band]++; if (r.h.band === "at_risk") out.riskValue += Number(r.won_value) || 0; out.avg += r.h.score; }
  out.avg = rows.length ? Math.round(out.avg / rows.length) : 0;
  return out;
}
