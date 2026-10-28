// Chance to close (pure, tested; C25): a naive-Bayes score learned from won / lost deals. SQL win_stats holds, per
// company and across all workspaces ("everyone": only non-identifying features, 3+ workspaces, no demo rows), how
// many won and lost leads had each feature value; private.win_stats_rebuild refreshes it nightly. featuresOf must
// stay in step with SQL private.lead_features.

export const MIN_CLOSED = 10; // closed deals needed before we show a number
const MIN_SEEN = 5;           // examples of a feature value before it counts
const SHRINK = 0.7;           // naive Bayes over-counts related features; damp each one

const fitBand = (s) => (s >= 80 ? "80+" : s >= 60 ? "60-79" : s >= 40 ? "40-59" : "0-39");
const has = (v) => String(!!String(v ?? "").trim());
const low = (v) => (v ? String(v).trim().toLowerCase() : null);

export function featuresOf(l = {}) {
  return [
    ["source", l.source || "none"], ["fit", fitBand(Number(l.score) || 0)],
    ["email", has(l.email)], ["phone", has(l.phone)], ["website", has(l.website)], ["person", has(l.contact_person)],
    ["whatsapp", String(!!l.wa_opt_in)], ["referred", String(!!l.referred_by)],
    ["industry", low(l.industry)], ["state", low(l.state)], ["city", low(l.city)],
  ].filter(([, v]) => v);
}

const SOURCE = { google_maps: "Google Maps", mca: "new companies", tender_winner: "tender winners", upload: "an imported list", referral: "a referral", linkedin: "LinkedIn", facebook: "Facebook", instagram: "Instagram", apollo: "Apollo", database: "bought data", google_ads: "Google Ads", whatsapp: "WhatsApp", indiamart: "IndiaMART", website: "your website", directory: "a directory" };
export function label(f, v) {
  const yes = v === "true";
  switch (f) {
    case "source": return `came from ${SOURCE[v] || v}`;
    case "fit": return `fit score ${v}`;
    case "email": return yes ? "has an email" : "no email";
    case "phone": return yes ? "has a phone" : "no phone";
    case "website": return yes ? "has a website" : "no website";
    case "person": return yes ? "named contact person" : "no contact person";
    case "whatsapp": return yes ? "agreed to WhatsApp" : "no WhatsApp opt-in";
    case "referred": return yes ? "referred by a customer" : "not referred";
    default: return `${f}: ${v}`;
  }
}

// rows: win_stats rows { company_id, feature, value, won, lost } for this company plus the global (company_id null) ones
export function winChance(lead, rows = []) {
  const idx = (scope) => new Map(rows.filter((r) => (scope ? r.company_id : !r.company_id)).map((r) => [`${r.feature}|${r.value}`, r]));
  const own = idx(true), all = idx(false);
  const tot = (m) => m.get("_all|_all") || { won: 0, lost: 0 };
  const T = { own: tot(own), all: tot(all) };
  const closed = (t) => t.won + t.lost;
  const base = closed(T.own) >= MIN_CLOSED ? "own" : closed(T.all) >= MIN_CLOSED ? "all" : null;
  if (!base) return { p: null, closed: closed(T.own), need: MIN_CLOSED };
  const odds = (w, l, W, L) => Math.log((w + 1) / (W + 2)) - Math.log((l + 1) / (L + 2));
  let z = Math.log((T[base].won + 1) / (T[base].lost + 1));
  const reasons = [];
  for (const [f, v] of featuresOf(lead)) {
    const k = `${f}|${v}`;
    const o = own.get(k), a = all.get(k);
    const [r, t] = o && closed(o) >= MIN_SEEN && closed(T.own) >= MIN_CLOSED ? [o, T.own] : a && closed(a) >= MIN_SEEN ? [a, T.all] : [null, null];
    if (!r) continue;
    const w = SHRINK * odds(r.won, r.lost, t.won, t.lost);
    z += w;
    if (Math.abs(w) >= 0.15) reasons.push({ text: label(f, v), weight: Math.round(w * 100) / 100 });
  }
  const p = Math.min(0.95, Math.max(0.02, 1 / (1 + Math.exp(-z))));
  reasons.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  return { p: Math.round(p * 100), basis: base === "own" ? "your deals" : "all Dhandha workspaces", closed: closed(T[base]), up: reasons.filter((r) => r.weight > 0).slice(0, 3), down: reasons.filter((r) => r.weight < 0).slice(0, 3) };
}
