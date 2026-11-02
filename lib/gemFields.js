// GeM bid document → data (pure, tested; free). Every GeM bid prints the same labelled "Bid Details" fields in Hindi and
// English ("…/Minimum Average Annual Turnover of the bidder … 10 Lakh (s)"). The English label is read; the Hindi text,
// the doubled glyphs and the page footers are dropped first. Used by the free reader (lib/tenderRules.js) so eligibility,
// deposits, the brief, "Get ready" and the price step use the bid's own figures (tender study F11, 1 Nov 2026).

const clean = (text) => String(text || "")
  .replace(/[ऀ-ॿ\u0001-\u0008\u000B\u000E-\u001F]+/g, " ")
  .replace(/\f/g, "\n")
  .replace(/[ \t]+/g, " ")
  .replace(/ *\n */g, "\n");

export const isGemBid = (text) => /GEM\/\d{4}\/[BR]\/\d+/.test(String(text)) && /Bid Details|Bid End Date/i.test(String(text));

const num = (s) => { if (s == null || s === "") return null; const n = Number(String(s).replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
// the value after a label: the first match of `value` within `span` characters of the label
function after(t, label, value, span = 220) {
  const i = t.search(label);
  if (i < 0) return null;
  const m = t.slice(i, i + span).match(value);
  return m ? m[1] : null;
}
const yes = (v) => (v == null ? null : /^yes/i.test(v));

export function parseGemFields(text) {
  const t = clean(text);
  if (!isGemBid(t)) return null;
  const g = {
    bid_no: (t.match(/GEM\/\d{4}\/[BR]\/\d+/) || [])[0] || null,
    end_at: after(t, /Bid End Date\/Time/, /(\d{2}-\d{2}-\d{4} \d{2}:\d{2}(?::\d{2})?)/, 60),
    validity_days: num(after(t, /Validity \(From End Date\)/, /(\d+)\s*\(?Days/i, 60)),
    ministry: after(t, /\/Ministry\/State Name/, /Name\s+([^\n]+)/, 140),
    department: after(t, /\/Department Name/, /Name\s+([^\n]+)/, 140),
    organisation: after(t, /\/Organisation Name/, /Name\s+([^\n]+)/, 140),
    office: after(t, /\/Office Name/, /Name\s+([^\n]+)/, 140),
    total_qty: num(after(t, /\/Total Quantity/, /Quantity\s+([\d,]+)/, 40)),
    contract_period: after(t, /\/Contract Period/, /Period\s+([^\n]+)/, 80),
    turnover_lakh: num(after(t, /Minimum Average Annual\s+Turnover/, /([\d.,]+)\s*Lakh/i, 240)),
    oem_turnover_lakh: num(after(t, /OEM Average Turnover/, /([\d.,]+)\s*Lakh/i, 160)),
    experience_years: num(after(t, /Years of Past Experience/, /(\d+)\s*Year/i, 200)),
    mse_relaxation: after(t, /\/MSE Relaxation for Years/, /\n\s*((?:Yes|No)[^\n]{0,40})/i, 200),
    startup_relaxation: after(t, /\/Startup Relaxation for Years/, /\n\s*((?:Yes|No)[^\n]{0,40})/i, 200),
    past_performance_pct: num(after(t, /\/Past Performance/, /Performance\s+(\d+)\s*%/, 60)),
    bid_to_ra: yes(after(t, /Bid to RA enabled/, /enabled\s+(Yes|No)/i, 40)),
    bid_type: after(t, /\/Type of Bid/, /Bid\s+((?:Two|Single)[^\n]*)/i, 60),
    evaluation: after(t, /\/Evaluation Method/, /Method\s+([^\n]+)/, 80),
    inspection: yes(after(t, /\/Inspection Required/, /\b(Yes|No)\b/, 220)),
    payment_days: num(after(t, /Payment Timelines/, /within\s+(\d+)\s+days/i, 200)),
    emd_inr: num(after(t, /EMD Amount/, /Amount\s+([\d,]+)/, 40)),
    epbg_pct: num(after(t, /ePBG Percentage/, /\(%\)\s*([\d.]+)/, 60)),
    epbg_months: num(after(t, /Duration of ePBG/, /\(Months\)\.?\s*(\d+)/, 80)),
    mse_preference: yes(after(t, /\/ ?MSE Purchase Preference/, /Preference\s+(Yes|No)/i, 60)),
    mse_margin_pct: num(after(t, /within L1\+X%/, /\n\s*(\d+)\s*\n/, 60)),
    mse_share_pct: num(after(t, /Percentage of Bid quantity/, /preference\s*\n\s*(\d+)/i, 200)),
    mii_preference: yes(after(t, /\/ ?MII Purchase Preference/, /Preference\s+(Yes|No)/i, 60)),
    option_pct: num((t.match(/OPTION CLAUSE\s*(\d+)\s*%/i) || t.match(/increase or decrease[\s\S]{0,140}?up to\s*(\d+)\s*(?:%|percent)/i) || [])[1]),
    treds: /TReDS\)? as Preferred mode/i.test(t) || null,
    auto_ext_min_bids: num(after(t, /disable automatic bid\s*extension/i, /extension\s+(\d+)/i, 40)),
    auto_ext_days: num(after(t, /Bid\s*would be auto-+extended/i, /extended\s+(\d+)/i, 40)),
    auto_ext_count: num(after(t, /Auto Extension count/i, /count\s+(\d+)/i, 30)),
    atc_attached: /Buyer uploaded ATC document/i.test(t) || null,
    attachments_mentioned: (t.match(/Click here to view the file/gi) || []).length || null,
    // "reserved only for proprietary vendor M/s. X Other bidders are not acceptable" (not "Reserved for MSE / Make in India")
    reserved_for: (t.replace(/\n/g, " ").match(/reserved\s+(?:only\s+)?for\s+(?:the\s+)?(?:(?:proprietary|single|authori[sz]ed|OEM)\s+)*(?:vendor|seller|OEM|firm|bidder|supplier)?\s*(M\/s\.?\s*[^.]{3,80}?)(?=\s+(?:other|offers?|only|who|as)\b|\s*[.,;(]|$)/i) || t.replace(/\n/g, " ").match(/\bonly\s+(M\/s\.?\s*[^.]{3,80}?)\s+(?:is|are)\s+eligible/i) || [])[1]?.replace(/\s+/g, " ").trim() || null,
    estimated_value_inr: num((t.match(/Estimated Bid Value\s*(?:\(in Rs\.?\))?\s*([\d,]{4,})/i) || [])[1]),
    documents_required: (after(t, /Document required\s+from seller/i, /seller\s+([\s\S]+?)(?:\n\*|\nIn case|$)/i, 600) || "").replace(/\s+/g, " ").trim() || null,
  };
  // study round 2 (Q13, Q21, Q26): order split between bidders, the buyer's wage sheet, floor price, highest offer wins
  if (/Splitting\s*Applied\s*Yes/i.test(t)) {
    const ratio = (t.match(/Split Criteria[^0-9]{0,160}?(\d{1,3}(?:\s*:\s*\d{1,3})+)/i) || [])[1];
    g.split = { bidders: num((t.match(/Amongst Whom the Order is to be Split\s*(\d{1,2})/i) || [])[1]), ratio: ratio ? ratio.split(":").map((x) => Number(x.trim())) : null };
  }
  const wages = [...t.replace(/\n/g, " ").matchAll(/(\d{1,4})\s+Minimum daily wage \(INR\)[^:]*:\s*([\d.]+)([^]{0,700}?)Tenure\/?\s*Duration of Employment \(in months\)\s*:\s*(\d{1,3})/gi)].slice(0, 30).map((m) => {
    const v = (label) => num((m[3].match(new RegExp(`${label}[^:]{0,30}:\\s*([\\d.]+)`, "i")) || [])[1]) || 0;
    return { people: Number(m[1]), daily_wage: Number(m[2]), bonus: v("Bonus"), edli: v("EDLI"), pf_admin: v("EPF Admin Charge"), esi: v("ESI \\(INR"), pf: v("Provident Fund"),
      allowances: v("Optional Allowances 1") + v("Optional Allowances 2") + v("Optional Allowances 3"), days: v("Number of working days in a month") || 26, months: Number(m[4]) };
  });
  if (wages.length) g.wages = wages;
  if (/created\/published with floor price|Minimum Floor Price defined by Buyer\s*:?\s*Yes/i.test(t)) g.floor_price = num((t.match(/(?:Minimum )?Floor Price[^0-9]{0,80}?(?:Rs\.?|₹|INR)?\s*([\d,]{4,})/i) || [])[1]) || true;
  if (/H1 Evaluation|Revenue Based Services/i.test(t)) g.highest_wins = true;
  if (/Excel Upload Required|Price Break-?up[^.]{0,40}\.xlsx|BOQ[^.]{0,40}\.xlsx/i.test(t)) g.excel_price_sheet = true;
  for (const k of Object.keys(g)) if (g[k] === null || g[k] === "") delete g[k];
  return g;
}

// Q13: the share of the order a bidder at rank 2, 3… gets by matching L1 (GeM splits as printed: 50:30:20 → rank 2 = 30%)
export function splitShare(g, rank) {
  const r = g?.split?.ratio;
  if (!r || !rank || rank < 1 || rank > r.length) return null;
  const total = r.reduce((a, b) => a + b, 0);
  return total ? Math.round((r[rank - 1] / total) * 1000) / 10 : null;
}

// Q21: the buyer's wage sheet as cost-planner manpower lines + statutory rates (per day amounts → % of the wage)
export function wageSheetLines(g) {
  const w = g?.wages;
  if (!w?.length) return null;
  const f = w[0];
  const pct = (x) => (f.daily_wage ? Math.round((x / f.daily_wage) * 10000) / 100 : 0);
  return {
    manpower: w.map((x, i) => ({ role: `${w.length > 1 ? `Office ${i + 1}: ` : ""}staff as per the buyer's wage sheet`, count: x.people, months: x.months, monthly_wage: Math.round(x.daily_wage * x.days) })),
    statutory: { pf_pct: pct(f.pf + f.edli + f.pf_admin), esi_pct: pct(f.esi), esi_wage_limit: f.esi ? 1e9 : 0, bonus_pct: pct(f.bonus), leave_pct: pct(f.allowances) },
    months: Math.max(...w.map((x) => x.months || 0)) || null,
  };
}

// The bid's figures in the reader's own field names (what the free reader already fills), so nothing else changes.
export function gemReadFields(g) {
  if (!g) return {};
  const f = {};
  if (g.turnover_lakh > 0) f.req_avg_turnover = Math.round(g.turnover_lakh * 100000);
  if (g.emd_inr >= 0 && g.emd_inr != null) f.emd_inr = g.emd_inr;
  if (g.validity_days > 0) f.bid_validity_days = g.validity_days;
  if (g.epbg_pct > 0) f.performance_security_pct = g.epbg_pct;
  if (g.estimated_value_inr > 0) f.value_inr = g.estimated_value_inr;
  if (g.experience_years > 0) f.req_similar_years = g.experience_years;
  return f;
}

// Plain lines for the brief and "Get ready before you file".
export function gemLines(g) {
  if (!g) return [];
  const L = [];
  const rs = (n) => `₹${Number(n).toLocaleString("en-IN")}`;
  if (g.reserved_for) L.push(`Reserved for ${g.reserved_for} — other bidders are not considered`);
  if (g.turnover_lakh) L.push(`Average annual turnover (last 3 years) at least ₹${g.turnover_lakh} lakh${g.mse_relaxation && /yes/i.test(g.mse_relaxation) ? ` — MSEs: relaxed (${g.mse_relaxation.replace(/^yes\s*\|?\s*/i, "") || "yes"})` : ""}`);
  if (g.turnover_lakh) L.push("GeM checks turnover in your seller profile, not the bid — update the last financial year there before filing");
  if (g.oem_turnover_lakh) L.push(`OEM's average turnover at least ₹${g.oem_turnover_lakh} lakh — keep the OEM's certificate ready`);
  if (g.experience_years) L.push(`${g.experience_years} year${g.experience_years === 1 ? "" : "s"} of experience in the same / similar work`);
  if (g.past_performance_pct) L.push(`Past performance: supplied at least ${g.past_performance_pct}% of the bid quantity to government in one of the last 3 years`);
  if (g.emd_inr != null) L.push(g.emd_inr ? `EMD ${rs(g.emd_inr)}` : "No EMD");
  if (g.epbg_pct) L.push(`Performance security (ePBG) ${g.epbg_pct}%${g.epbg_months ? ` for ${g.epbg_months} months` : ""} — on award`);
  if (g.option_pct) L.push(`Option clause: the buyer may raise or cut quantity / duration by up to ${g.option_pct}% at the same rates`);
  if (g.mse_preference) L.push(`MSE purchase preference: an MSE within L1+${g.mse_margin_pct || 15}% may match L1${g.mse_share_pct ? ` for ${g.mse_share_pct}% of the order` : ""} (manufacturers / service providers, not traders)`);
  if (g.mii_preference) L.push("Make in India purchase preference applies (Class-I local suppliers)");
  if (g.bid_to_ra) L.push("Reverse auction after the technical stage — prices are cut live");
  if (g.inspection) L.push("Inspection by an empanelled agency before acceptance");
  if (g.payment_days) L.push(`Payment within ${g.payment_days} days of the receipt certificate${g.treds ? " (TReDS preferred)" : ""}`);
  if (g.auto_ext_min_bids) L.push(`If fewer than ${g.auto_ext_min_bids} bids arrive, GeM extends the closing by ${g.auto_ext_days || "a few"} days (up to ${g.auto_ext_count || "several"} times)`);
  if (g.atc_attached || g.attachments_mentioned) L.push("The buyer's own terms are in attached files — read them before filing");
  return L;
}

// Price step (tender study F12, Q7 yes): what the MSE and Make-in-India purchase preferences mean for this bid. GeM's
// usual rules: when L1 is not an MSE, an MSE within L1 + X% (15 by default) may match L1 and gets the bid's MSE share
// (25% by default; the whole order when the quantity is one). A Class-I local supplier (≥50% local content) within
// L1 + 20% may match L1 when L1 is not Class-I, and gets 50% of a divisible order (all of a single item). The bid's own
// ATC wins over these defaults, which is why every line says "usually".
export function matchL1({ gem, msme = false, classOne = false, ourPrice, l1Price, l1IsMse = false, l1IsClassOne = false } = {}) {
  const ours = Number(ourPrice) || 0, l1 = Number(l1Price) || 0;
  if (!gem || !ours || !l1) return [];
  const rs = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;
  const single = gem.total_qty === 1;
  const out = [];
  if (ours <= l1) out.push({ kind: "l1", ok: true, line: `At ${rs(ours)} you are L1 — the whole order is yours if you qualify.` });
  if (gem.mse_preference) {
    const m = gem.mse_margin_pct || 15, cap = l1 * (1 + m / 100), share = single ? 100 : gem.mse_share_pct || 25;
    if (!msme) out.push({ kind: "mse", ok: false, line: `MSE preference applies, but only to MSEs with Udyam (manufacturers / service providers). Add your Udyam number in the Vault if you have one.` });
    else if (ours <= l1) out.push({ kind: "mse", ok: true, line: "You are L1 already; the MSE preference is not needed." });
    else if (l1IsMse) out.push({ kind: "mse", ok: false, line: "L1 is itself an MSE, so there is no matching — only being L1 wins." });
    else if (ours <= cap) out.push({ kind: "mse", ok: true, line: `You are within L1 + ${m}% (up to ${rs(cap)}): GeM usually offers you to match L1 at ${rs(l1)} for ${share}% of the order${share < 100 ? " (shared if several MSEs match)" : ""}.` });
    else out.push({ kind: "mse", ok: false, line: `Above L1 + ${m}% (${rs(cap)}): too high to be asked to match. Come down by ${rs(ours - cap)} to stay in.` });
  }
  if (gem.mii_preference) {
    const cap = l1 * 1.2, share = single ? 100 : 50;
    if (!classOne) out.push({ kind: "mii", ok: false, line: "Make in India preference: only offers with at least 50% local content (Class-I) can match L1. Tick it if yours is." });
    else if (ours <= l1) out.push({ kind: "mii", ok: true, line: "You are L1 already; the Make in India preference is not needed." });
    else if (l1IsClassOne) out.push({ kind: "mii", ok: false, line: "L1 is itself Class-I local, so there is no matching." });
    else if (ours <= cap) out.push({ kind: "mii", ok: true, line: `Class-I within L1 + 20% (up to ${rs(cap)}): you are usually asked to match L1 at ${rs(l1)} for ${share}% of the order.` });
    else out.push({ kind: "mii", ok: false, line: `Above L1 + 20% (${rs(cap)}): too high to be asked to match.` });
  }
  if (out.length && ours > l1) {
    const left = out.filter((o) => o.ok);
    const best = left.length ? Math.max(...left.map((o) => (/(\d+)% of the order/.exec(o.line) || [0, 0])[1] * 1)) : 0;
    if (left.length) out.push({ kind: "net", ok: true, line: `If you match, you work at ${rs(l1)}, not your ${rs(ours)} — check it still covers your cost${best ? `, for ${best}% of the order` : ""}.` });
  }
  return out;
}

// Reverse auction (Q3 yes): the lowest price to accept while prices are cut live — cost plus the smallest margin you
// accept — and how much room the quote leaves above it.
export function raFloor({ cost, minMargin = 3, quote } = {}) {
  const c = Number(cost) || 0;
  if (!c) return null;
  const floor = Math.ceil(c * (1 + (Number(minMargin) || 0) / 100));
  const q = Number(quote) || 0;
  return { floor, room: q ? q - floor : null, roomPct: q ? Math.round(((q - floor) / q) * 1000) / 10 : null };
}
