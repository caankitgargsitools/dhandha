import { findFinTests } from "./finTests.js";
import { findCredentials } from "./credentials.js";
import { parseGemFields, gemReadFields, gemLines } from "./gemFields.js";
// Rule-based tender reader (no AI, no cost). Pulls the common NIT / ITB facts out of tender text.
// Every finding carries the page it came from, so a person can check it.

const NUM = "([0-9][0-9,]*(?:\\.[0-9]+)?)";
const UNIT = "\\s*(crores?|cr\\.?|lakhs?|lacs?|lac|thousand)?";
function amount(n, unit) {
  let v = Number(String(n).replace(/,/g, ""));
  if (!Number.isFinite(v)) return null;
  const u = String(unit || "").toLowerCase();
  if (u.startsWith("cr")) v *= 1e7; else if (u.startsWith("la")) v *= 1e5; else if (u.startsWith("th")) v *= 1e3;
  return v;
}
const WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, ten: 10 };
const toInt = (s) => (WORDNUM[String(s).toLowerCase()] ?? Number(s));

function findFirst(pages, re) {
  for (let i = 0; i < pages.length; i++) {
    const m = pages[i].match(re);
    if (m) return { m, page: i + 1 };
  }
  return null;
}
function findAll(pages, re) {
  const out = [];
  pages.forEach((p, i) => { for (const m of p.matchAll(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"))) out.push({ m, page: i + 1 }); });
  return out;
}
const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function istDate(s) {
  let m = String(s).match(/(\d{1,2})[-\/. ]([A-Za-z]{3,9}|\d{1,2})[-\/. ,]+(\d{4})(?:\D{0,12}(\d{1,2})[:.](\d{2})\s*(AM|PM|Hrs|hours)?)?/i);
  if (!m) return null;
  const mon = isNaN(m[2]) ? MON[m[2].slice(0, 3).toLowerCase()] : Number(m[2]) - 1;
  if (mon === undefined || mon < 0 || mon > 11) return null;
  let h = Number(m[4] || 0);
  if (/pm/i.test(m[6] || "") && h < 12) h += 12;
  return new Date(Date.UTC(Number(m[3]), mon, Number(m[1]), h, Number(m[5] || 0)) - 330 * 60000).toISOString();
}

const DOC_RULES = [
  ["REG-PAN", /\bPAN\b|permanent account number/i],
  ["REG-GST", /\bGST(IN)?\b.{0,40}(registration|certificate|number)/i],
  ["REG-INC", /certificate of incorporation|partnership deed|registration of (the )?firm|memorandum of association/i],
  ["FIN-AUDIT", /audited (balance sheet|financial statements|accounts)|profit (and|&) loss/i],
  ["FIN-ITR", /income tax returns?|\bITR\b/i],
  ["FIN-CA-CERT", /certificate from (a )?chartered accountant|CA certificate|certified by (a )?chartered accountant/i],
  ["FIN-SOLV", /solvency certificate|bank solvency/i],
  ["EXP-WO", /work orders?|purchase orders?/i],
  ["EXP-CC", /completion certificates?|performance certificates?/i],
  ["CERT-ISO", /\bISO\s?9001|\bISO\s?27001|ISO certif/i],
  ["CERT-EPF", /\bEPF\b|provident fund registration/i],
  ["CERT-ESI", /\bESI(C)?\b/i],
  ["CERT-LAB", /labou?r licen[cs]e/i],
  ["CERT-CONTR", /enlist(ment|ed)|registered contractor|contractor registration|class[- ](I|II|III|A|B|C)\b/i],
  ["REG-UDYAM", /\bUdyam\b|\bMSME\b|micro (and|&) small|\bNSIC\b/i],
  ["LEG-POA", /power of attorney|board resolution|authori[sz]ation letter/i],
  ["DSC", /digital signature certificate|class[- ]?(III|3) DSC/i],
  ["CERT-ICAI", /\bICAI\b|firm registration number|\bFRN\b/i],
  ["CERT-PEER", /peer review/i],
];

const RISK_RULES = [
  [/liquidated damages?[^.]{0,160}/i, "Liquidated damages"],
  [/(penalty|penalties)[^.]{0,140}(per (day|week)|% ?per)[^.]{0,80}/i, "Penalty for delay"],
  [/no (price variation|escalation)[^.]{0,120}/i, "No price variation / escalation"],
  [/performance (security|guarantee)[^.]{0,40}(\d{1,2}(\.\d+)?)\s*%[^.]{0,80}/i, "Performance security"],
  [/(defect liability|maintenance) period[^.]{0,40}(\d+)\s*(months|years)[^.]{0,60}/i, "Defect liability period"],
  [/unlimited liability[^.]{0,120}/i, "Unlimited liability"],
  [/(forfeit(ed|ure)?)[^.]{0,140}/i, "Forfeiture"],
  [/(blacklist|debar)[^.]{0,140}/i, "Blacklisting / debarment"],
  [/arbitration[^.]{0,140}/i, "Arbitration"],
];

export function readTenderText(pages) {
  const fields = {}, evidence = {};
  const put = (k, v, page, quote) => { if (v === null || v === undefined || Number.isNaN(v)) return; fields[k] = v; evidence[k] = { page, quote: String(quote).replace(/\s+/g, " ").trim().slice(0, 180) }; };

  // estimated cost / value
  let f = findFirst(pages, new RegExp(`(estimated (cost|value)|tender value|value of (the )?work|cost of (the )?work|\\bECV\\b|approximate value)[^0-9₹]{0,60}(?:Rs\\.?|₹|INR)?\\s*${NUM}${UNIT}`, "i"));
  if (f) put("value_inr", amount(f.m[5], f.m[6]), f.page, f.m[0]);
  // EMD
  f = findFirst(pages, new RegExp(`(earnest money( deposit)?|\\bEMD\\b|bid security)[^0-9₹]{0,60}(?:Rs\\.?|₹|INR)?\\s*${NUM}${UNIT}`, "i"));
  if (f) put("emd_inr", amount(f.m[3], f.m[4]), f.page, f.m[0]);
  // MSE exemption
  f = findFirst(pages, /(micro and small enterprises?|MSEs?|NSIC|Udyam)[^.]{0,120}(exempt(ed|ion)?)[^.]{0,60}(EMD|earnest|tender fee|bid security)/i);
  if (f) put("mse_emd_exempt", true, f.page, f.m[0]);
  f = findFirst(pages, /(no exemption|not exempted?)[^.]{0,80}(EMD|earnest)/i);
  if (f) put("mse_emd_exempt", false, f.page, f.m[0]);

  // average annual turnover
  f = findFirst(pages, /average annual (financial )?turnover[^.]{0,220}?(\d{1,3}(?:\.\d+)?)\s*%/i);
  if (f && fields.value_inr) put("req_avg_turnover", (Number(f.m[2]) / 100) * fields.value_inr, f.page, f.m[0]);
  if (!fields.req_avg_turnover) {
    f = findFirst(pages, new RegExp(`average annual (financial )?turnover[^.]{0,160}?(?:Rs\\.?|₹|INR)\\s*${NUM}${UNIT}`, "i"));
    if (f) put("req_avg_turnover", amount(f.m[2], f.m[3]), f.page, f.m[0]);
  }
  if (fields.req_avg_turnover) {
    const yr = findFirst(pages, /average annual (financial )?turnover[^.]{0,120}?(last|preceding|immediately preceding)\s+(\d|three|five|two)\s+(financial )?years/i);
    if (yr) put("turnover_years", toInt(yr.m[3]), yr.page, yr.m[0]);
  }

  // similar works: "three similar works each costing not less than 40%", "two ... 60%", "one ... 80%"
  for (const { m, page } of findAll(pages, /(one|two|three|1|2|3)\s+similar (completed )?works?[^.%]{0,120}?(\d{2})\s*%/gi)) {
    const n = toInt(m[1]), pct = Number(m[3]) / 100;
    if (!fields.value_inr || !pct) continue;
    const key = { 1: "req_similar_one", 2: "req_similar_two", 3: "req_similar_three" }[n];
    if (key && !fields[key]) put(key, pct * fields.value_inr, page, m[0]);
  }
  f = findFirst(pages, /similar works?[^.]{0,200}?(last|preceding|past)\s+(\d{1,2}|seven|five|three|ten)\s+years/i);
  if (f) put("req_similar_years", toInt(f.m[2]), f.page, f.m[0]);

  // dates and periods
  f = findFirst(pages, /(bid submission end date|last date (and time )?(for|of) (submission|receipt)[^:]{0,40}|closing date)[^0-9]{0,20}([0-9]{1,2}[-\/. ][A-Za-z0-9]{2,9}[-\/. ,]+[0-9]{4}[^\n]{0,20})/i);
  if (f) put("due_at", istDate(f.m[5]), f.page, f.m[0]);
  f = findFirst(pages, /pre[- ]?bid (meeting|conference)[^0-9]{0,40}([0-9]{1,2}[-\/. ][A-Za-z0-9]{2,9}[-\/. ,]+[0-9]{4})/i);
  if (f) { const d = istDate(f.m[2]); put("prebid_on", d ? new Date(Date.parse(d) + 330 * 60000).toISOString().slice(0, 10) : null, f.page, f.m[0]); }
  f = findFirst(pages, /(time (allowed )?for completion|completion period|period of completion|contract period)[^0-9]{0,30}(\d{1,3})\s*(months?|days|years?)/i);
  if (f) put("completion_period", `${f.m[3]} ${f.m[4]}`, f.page, f.m[0]);
  f = findFirst(pages, /(bid|tender|offer)s? (shall|must|will) (remain )?valid[^0-9]{0,40}(\d{2,3})\s*days/i);
  if (f) put("bid_validity_days", Number(f.m[4]), f.page, f.m[0]);
  f = findFirst(pages, /performance (security|guarantee)[^%]{0,60}?(\d{1,2}(?:\.\d+)?)\s*%/i);
  if (f) put("performance_security_pct", Number(f.m[2]), f.page, f.m[0]);

  // documents asked for
  const all = pages.join("\n");
  const required_docs = DOC_RULES.filter(([, re]) => re.test(all)).map(([code]) => code);

  // formats / annexures, with the wording that follows each heading (needed to fill custom formats)
  const formats = [], seen = new Set();
  const offsets = []; let full = "";
  pages.forEach((p, i) => { offsets.push(full.length); full += p + "\n"; });
  const pageAt = (pos) => { let pg = 1; offsets.forEach((o, i) => { if (pos >= o) pg = i + 1; }); return pg; };
  const heads = [];
  let pos = 0;
  for (const line of full.split("\n")) {
    const clean = line.trim().replace(/\s*\.{3,}\s*\d+\s*$/, ""); // an index line "Annexure-I Bid Form ...... 23"
    const m = clean.match(/^(annexure|annex|appendix|form|format|schedule|proforma)[\s.-]*([A-Z]{1,3}|[0-9]{1,2}|[IVX]{1,5})?\b[\s:–.-]*(.{0,90})$/i);
    if (m && line.length <= 120) {
      if (m[2] && m[2] !== m[2].toUpperCase()) m[2] = undefined; // "Form of Bid": "of" is not an identifier
      // a sentence that merely starts with "Schedule of payment will be…" is not a heading
      if (!m[2] && (/\b(will|shall|is|are|was|were|as follows|should|must|may)\b/i.test(m[3] || "") || clean.split(/\s+/).length > 9)) { pos += line.length + 1; continue; }
      const title = (m[2] ? `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} ${m[2]}${m[3] ? " - " + m[3].trim() : ""}` : clean).replace(/\s+/g, " ");
      heads.push({ title, key: formatId(title) || title.toLowerCase(), start: pos });
    }
    pos += line.length + 1;
  }
  // a heading seen twice (index list, then the format itself): keep the later one, which carries the wording
  heads.forEach((h, i) => {
    const next = heads[i + 1]?.start ?? Math.min(full.length, h.start + 12000);
    const text = full.slice(h.start, Math.min(next, h.start + 12000)).trim();
    const prev = formats.findIndex((f) => f._key === h.key);
    const item = { title: h.title, page: pageAt(h.start), text, _key: h.key };
    if (prev >= 0) { if (text.length > formats[prev].text.length) formats[prev] = item; }
    else formats.push(item);
  });
  formats.forEach((f) => delete f._key);

  // risky clauses
  const risks = [];
  for (const [re, label] of RISK_RULES) {
    const r = findFirst(pages, re);
    if (r) risks.push({ label, text: r.m[0].replace(/\s+/g, " ").trim().slice(0, 220), page: r.page });
  }

  // railway / PSU money tests beyond average turnover (lib/finTests.js); checked against the Vault where shown
  const fin = findFinTests(pages.join(" "));
  if (fin) fields.fin_tests = fin;
  // licences, registrations, empanelments and counts each kind of business is asked for (lib/credentials.js) —
  // also what Dhandha learns from: SQL credential_stats counts them per industry across fetched tenders
  const creds = findCredentials(pages.join(" "));
  if (creds.length) fields.credentials = creds;

  // GeM bids print their figures as labelled fields: read them exactly, and they win over the general patterns above
  const gem = parseGemFields(pages.join("\n"));
  if (gem) {
    Object.assign(fields, gemReadFields(gem));
    fields.gem = gem;
    fields.prepare_before = gemLines(gem);
  }
  if (fin?.liquid) (fields.prepare_before ||= []).push(`Bank letter / certificate on ${fin.liquid.kind}${fin.liquid.pct ? ` (at least ${fin.liquid.pct}% of the value)` : ""}${fin.liquid.letter_months ? `, dated within ${fin.liquid.letter_months} months of closing` : ""}`);

  const key = ["value_inr", "emd_inr", "req_avg_turnover", "req_similar_one", "due_at"];
  const confidence = Math.round((key.filter((k) => fields[k] !== undefined).length / key.length) * 100);
  return { fields, evidence, required_docs, formats: formats.slice(0, 40), risks, confidence };
}

// One identifier for a format however a tender writes it: "Annexure-I", "Annex 1", "ANNEXURE 01" → "annexure 1";
// "Form T-3", "Format T3", "Proforma T 3" → "form t3".
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16, xvii: 17, xviii: 18, xix: 19, xx: 20 };
export function formatId(title) {
  const m = String(title || "").match(/^\s*(annexure|annex|appendix|attachment|form|format|proforma|schedule)[\s.:-]*([A-Z]{0,2}[\s-]?[0-9]{1,3}[A-Z]?|[IVXivx]{1,5}|[A-Z])\b/i);
  if (!m) return null;
  const kind = /annex|appendix|attachment/i.test(m[1]) ? "annexure" : /schedule/i.test(m[1]) ? "schedule" : "form";
  let id = m[2].toLowerCase().replace(/[\s-]/g, "");
  if (ROMAN[id]) id = String(ROMAN[id]); // "Annexure-I", "Annexure V": tenders number annexures in roman far more than by letter I / V / X
  else id = id.replace(/^([a-z]*)0+(\d)/, "$1$2");
  return `${kind} ${id}`;
}
