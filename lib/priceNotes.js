// The price step's notes and starting lines from what the free reader found in a bid (study round 2, owner's Yes to
// Q13, Q19, Q21, Q25, Q26, Q28, Q29, Q35, Q36; 2 Nov 2026). Pure and tested.
import { splitShare, wageSheetLines } from "./gemFields.js";
import { manpowerCost, STATUTORY } from "./costing.js";

const rs = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;

// Plain warnings / facts for the price step.
export function priceNotes({ gem = null, terms = null } = {}) {
  const N = [];
  if (gem?.highest_wins) N.push({ tone: "warn", text: "Highest offer wins (revenue bid): you pay the buyer. Quote what you can pay after your costs and margin — the cost planner's quote is the most you should offer." });
  if (gem?.floor_price) N.push({ tone: "warn", text: `The buyer set a floor price${typeof gem.floor_price === "number" ? ` of ${rs(gem.floor_price)}` : " (hidden on GeM)"} — quotes below it are rejected.` });
  if (gem?.split?.ratio) {
    const r = gem.split.ratio;
    N.push({ tone: "info", text: `The order is split ${r.join(":")} among ${gem.split.bidders || r.length} bidders: coming 2nd and matching L1's price still wins ${splitShare(gem, 2)}% of the order${r.length > 2 ? `, 3rd ${splitShare(gem, 3)}%` : ""}.` });
  }
  const g = terms?.gst;
  if (g?.concessional_pct != null) N.push({ tone: "warn", text: `Quote GST at the concessional ${g.concessional_pct}% — quoting 18% makes your bid look dearer.` });
  if (g?.lower_of) N.push({ tone: "warn", text: "GST is paid at actuals or your quoted rate, whichever is lower — quote the correct rate for your HSN / SAC; a lower rate is a loss." });
  if (g?.reverse_charge) N.push({ tone: "warn", text: "Reverse charge (RCM): the buyer pays the GST — quote without GST." });
  if (g?.loading) N.push({ tone: "info", text: `Your price is loaded for ranking only (paid at the quoted price): “${String(g.loading).slice(0, 160)}”` });
  for (const rule of terms?.price_sheet_rules || []) N.push({ tone: "warn", text: `Buyer's price sheet: ${rule}.` });
  if (gem?.excel_price_sheet) N.push({ tone: "info", text: "The buyer's own Excel price sheet must be uploaded — use “Download priced BOQ” in the planner to fill it." });
  if (terms?.price_basis) N.push({ tone: "info", text: `Price basis: ${terms.price_basis} — include freight and transit insurance to the site.` });
  if (terms?.remote_km) N.push({ tone: "info", text: `Remote site: ${terms.remote_km} km from the nearest rail / air head${terms.loading_unloading ? "; loading and unloading are yours" : ""}.` });
  for (const h of terms?.hardware || []) N.push({ tone: "warn", text: h.label });
  return N;
}

// Lines the cost planner starts with: the buyer's wage sheet, a wage-rise buffer, post-audit support, warranty items,
// freight / insurance / remote site.
export function starterLines({ gem = null, terms = null, months = 12 } = {}) {
  const ws = wageSheetLines(gem);
  const manpower = ws?.manpower || [];
  const statutory = ws?.statutory ? { ...STATUTORY, ...ws.statutory } : null;
  const m = ws?.months || months;
  const other = [];
  if (terms?.clauses?.some((c) => c.kind === "wages_yours") && manpower.length) {
    // minimum wages are revised every 6 months (VDA); about 2.5% a time, on average half the rises over the contract
    const base = manpower.reduce((a, l) => a + manpowerCost(l, statutory || STATUTORY, m).total, 0);
    const pct = 2.5 * Math.floor(m / 6) / 2;
    if (pct > 0) other.push({ item: `Wage-rise buffer — revised minimum wages are yours (≈${pct}% over ${m} months)`, amount: Math.round(base * pct / 100) });
  }
  if (terms?.post_audit_months) other.push({ item: `Post-audit support: ${terms.post_audit_months} months (≈4 hours a month)`, amount: terms.post_audit_months * 4 * 1500 });
  for (const h of terms?.hardware || []) other.push({ item: { disks_retained: "Replacement disks kept by the buyer (expected failures × disk price)", service_centres: "Service engineer visits per consignee state", asset_tags: "Asset tags / warranty stickers", page_count: "Toner / drum after the warranty page count", whole_unit: "Spare units for whole-unit replacements" }[h.kind] || h.label, amount: "" });
  if (terms?.price_basis && /FOR|CIP|CIF|DDP/i.test(terms.price_basis)) other.push({ item: "Freight to site", amount: "" }, { item: "Transit insurance", amount: "" });
  if (terms?.remote_km) other.push({ item: `Remote site (${terms.remote_km} km from rail / air head)${terms.loading_unloading ? " incl. loading / unloading" : ""}`, amount: "" });
  return { manpower, statutory, months: ws?.months || null, other };
}

// Q36: spread a lump sum over a schedule of rates. Lines fixed at minimum wages keep their rate; the rest are raised
// in proportion to their own (floor) rates so the total comes to the lump sum.
export function spreadOverSor(rows = [], target, isFixed = (r) => /minimum wage|wages?\b|manpower|labour/i.test(String(r.item || ""))) {
  const val = (r) => (Number(r.qty) || 0) * (Number(r.rate) || 0);
  const fixed = rows.filter(isFixed).reduce((a, r) => a + val(r), 0);
  const base = rows.filter((r) => !isFixed(r)).reduce((a, r) => a + val(r), 0);
  const t = Number(target) || 0;
  if (!base || t <= fixed) return null;
  const k = (t - fixed) / base;
  return rows.map((r) => (isFixed(r) || !val(r) ? r : { ...r, rate: String(Math.round(Number(r.rate) * k * 100) / 100) }));
}
