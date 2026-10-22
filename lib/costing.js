// Cost planner for a tender's price bid: BOQ items, manpower (with statutory costs), travel and stay, other direct
// costs, then overheads, contingency, margin and GST → a suggested quote, compared with the tender's estimate.
// Pure functions: the planner recalculates live in the browser and the server stores the same numbers.

const num = (v) => { const n = Number(String(v ?? "").replace(/[,₹\s]/g, "")); return Number.isFinite(n) ? n : 0; };
const r2 = (n) => Math.round(n * 100) / 100;

// Indian statutory add-ons on wages (employer's share), editable per sheet.
export const STATUTORY = { pf_pct: 13, esi_pct: 3.25, esi_wage_limit: 21000, bonus_pct: 8.33, leave_pct: 0 };

export function emptySheet({ months = 12, value = null, scope = [], travel = false } = {}) {
  return {
    boq: scope.slice(0, 8).map((s) => ({ item: String(s).slice(0, 140), unit: "job", qty: "", rate: "" })),
    manpower: [],
    statutory: { ...STATUTORY },
    travel: travel ? [{ purpose: "Site visits", trips: "", persons: 1, fare: "", days: 1, per_diem: 1000, stay: 2500 }] : [],
    other: [],
    months,
    overhead_pct: 10, contingency_pct: 3, margin_pct: 10, gst_pct: 18,
    estimate: value,
  };
}

// One manpower line: count × months × (wage + PF + ESI if under the limit + bonus + leave).
export function manpowerCost(line, st = STATUTORY, months = 12) {
  const wage = num(line.monthly_wage), count = num(line.count), m = num(line.months) || num(months);
  const esi = wage <= num(st.esi_wage_limit) ? num(st.esi_pct) : 0;
  const perMonth = wage * (1 + (num(st.pf_pct) + esi + num(st.bonus_pct) + num(st.leave_pct)) / 100);
  return { perMonth: r2(perMonth), total: r2(perMonth * count * m) };
}

// One travel line: trips × persons × (fare + days × (per diem + stay)).
export const travelCost = (t) => r2(num(t.trips) * num(t.persons) * (num(t.fare) + num(t.days) * (num(t.per_diem) + num(t.stay))));

export function computeSheet(s) {
  const boq = (s.boq || []).reduce((a, b) => a + num(b.qty) * num(b.rate), 0);
  const manpower = (s.manpower || []).reduce((a, l) => a + manpowerCost(l, s.statutory || STATUTORY, s.months).total, 0);
  const travel = (s.travel || []).reduce((a, t) => a + travelCost(t), 0);
  const other = (s.other || []).reduce((a, o) => a + num(o.amount), 0);
  const direct = boq + manpower + travel + other;
  const overhead = direct * num(s.overhead_pct) / 100;
  const contingency = direct * num(s.contingency_pct) / 100;
  const cost = direct + overhead + contingency;
  const margin = cost * num(s.margin_pct) / 100;
  const quote = cost + margin;
  const gst = quote * num(s.gst_pct) / 100;
  const estimate = num(s.estimate) || null;
  return {
    boq: r2(boq), manpower: r2(manpower), travel: r2(travel), other: r2(other), direct: r2(direct),
    overhead: r2(overhead), contingency: r2(contingency), cost: r2(cost), margin: r2(margin),
    quote: Math.round(quote), gst: r2(gst), withGst: Math.round(quote + gst),
    vsEstimatePct: estimate && quote ? r2(((quote - estimate) / estimate) * 100) : null,
  };
}

// Keeps a sheet from the browser to a known shape and size before it is stored.
export function cleanSheet(s) {
  const rows = (a, keys, max = 60) => (Array.isArray(a) ? a : []).slice(0, max).map((r) => Object.fromEntries(keys.map((k) => [k, typeof r?.[k] === "number" ? r[k] : String(r?.[k] ?? "").slice(0, 160)])));
  const pct = (v, d) => Math.min(100, Math.max(0, num(v ?? d)));
  return {
    boq: rows(s.boq, ["item", "unit", "qty", "rate"]),
    manpower: rows(s.manpower, ["role", "count", "months", "monthly_wage"]),
    statutory: Object.fromEntries(Object.entries(STATUTORY).map(([k, d]) => [k, k === "esi_wage_limit" ? num(s.statutory?.[k] ?? d) : pct(s.statutory?.[k], d)])),
    travel: rows(s.travel, ["purpose", "trips", "persons", "fare", "days", "per_diem", "stay"]),
    other: rows(s.other, ["item", "amount"]),
    months: Math.min(120, Math.max(1, num(s.months) || 12)),
    overhead_pct: pct(s.overhead_pct, 10), contingency_pct: pct(s.contingency_pct, 3), margin_pct: pct(s.margin_pct, 10), gst_pct: pct(s.gst_pct, 18),
    estimate: num(s.estimate) || null,
  };
}

// "180" days / "6 months" / "1 year" → months (for manpower and BOQ defaults).
export function monthsFrom(period) {
  const t = String(period || "").toLowerCase();
  const n = Number((t.match(/(\d+(?:\.\d+)?)/) || [])[1]);
  if (!n) return 12;
  if (/year/.test(t)) return Math.round(n * 12);
  if (/month/.test(t)) return Math.round(n);
  if (/week/.test(t)) return Math.max(1, Math.round(n / 4.3));
  return Math.max(1, Math.round(n / 30)); // days (GePNIC "Period of work (days)")
}
