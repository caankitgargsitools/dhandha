// Lead autopilot helpers with no database or network (tested in tests/autopilot.test.mjs). SQL
// (autopilot_cost_per_lead, autopilot_claim) is the source of truth for money; these mirror it for the settings page.
import { scoreLead } from "./leads.js";

// Sources the autopilot can buy from, with what one lead costs to find (credits = rupees).
export const AUTO_SOURCES = [
  { code: "google_maps", label: "Google Maps businesses", note: "Businesses on Google Maps for your searches and areas — phone, address, website", find: 2 },
  { code: "tender_winner", label: "Tender winners", note: "Firms that just won government tenders in your field and states", find: 2 },
  { code: "mca", label: "New companies (MCA)", note: "Companies registered in the last months in your states", find: 2 },
];
export const PAID_SOURCES = AUTO_SOURCES.map((s) => s.code);

// Expected credits per lead: finding it + the sequence's messages + an AI call (2 minutes) when switched on.
export function costPerLead({ find = 2, steps = [], call = false, prices = {} } = {}) {
  const msg = steps.reduce((t, s) => t + (s.channel === "email" ? prices.email_send ?? 0.1 : prices.whatsapp_send ?? 0.2), 0);
  return Math.round((find + msg + (call ? 2 * (prices.ai_call_min ?? 8) : 0)) * 100) / 100;
}

// How many leads a day the budget buys, and how they split over the chosen sources.
export function budgetPlan(budget, sources, perLead) {
  const chosen = (sources || []).filter((s) => PAID_SOURCES.includes(s));
  const total = perLead > 0 ? Math.floor((Number(budget) || 0) / perLead) : 0;
  const each = chosen.length ? Math.ceil(total / chosen.length) : 0;
  let left = total;
  const split = chosen.map((s) => { const n = Math.min(each, left); left -= n; return { source: s, leads: n }; });
  return { total, perLead, split, monthly: total * 30, spend: Math.round(total * perLead * 100) / 100 };
}

// Rows for import from a tender winner / new company candidate.
export function winnerRow(w) {
  return {
    name: w.bidder_name, city: w.bidder_city || null, state: w.state || null, award_id: w.award_id, address: w.bidder_address || null,
    notes: [`Won: ${w.title}`, w.authority && `Authority: ${w.authority}`, w.awarded_value && `Value: ₹${Number(w.awarded_value).toLocaleString("en-IN")}`, w.wins > 1 && `${w.wins} wins in total`].filter(Boolean).join("\n"),
  };
}
export function mcaRow(m) {
  return {
    name: m.name, cin: m.cin, state: m.state || null, industry: m.activity || null, email: m.email || null, address: m.address || null,
    notes: [m.incorporated_on && `Registered ${m.incorporated_on}`, m.paid_up_capital && `Paid-up capital ₹${Number(m.paid_up_capital).toLocaleString("en-IN")}`, m.address && `Address: ${m.address}`].filter(Boolean).join("\n"),
  };
}

// Score with the free fit score, drop those under the minimum, keep the best n.
export function pickBest(rows, { n, minScore = 0, ideal = {}, source }) {
  return rows
    .map((r) => { const s = scoreLead({ ...r, source }, ideal || {}); return { ...r, score: s.score, score_reasons: s.reasons }; })
    .filter((r) => r.name && r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, n));
}

// Searches for Google Maps: each "what" in each area, e.g. "chartered accountant in Sector 18, Noida".
export function mapsQueries(queries = []) {
  return queries.flatMap((q) => String(q.areas || q.area || "").split(/[;\n]/).map((a) => a.trim()).filter(Boolean).map((a) => `${q.what || q.q} in ${a}`)).filter((s) => !/^undefined|^ in /.test(s)).slice(0, 20);
}
