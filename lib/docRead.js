// Vault document reading (pure, tested). Every document put into the Vault is read and what it says goes into the
// masters: company record, facts (turnover, net worth, capital…), key people (directors, partners, shareholders) and
// experience (work orders, completion certificates).
// Cost order: the free reader first — certificates with typed text (GST, PAN, Udyam, incorporation, ICAI) give their
// numbers to patterns; AI (paid tiers only: this is the customer's private data) reads financial statements, MoA / AoA,
// deeds, work orders and scanned copies.
// Nothing the person typed is overwritten: empty fields are filled, and a different value becomes a "conflict" the
// person settles with one tap.

export const RX = {
  gstin: /\b(\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/,
  pan: /\b([A-Z]{3}[ABCFGHLJPTK][A-Z]\d{4}[A-Z])\b/,
  cin: /\b([LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\b/,
  llpin: /\b([A-Z]{3}-\d{4})\b/,
  udyam: /\b(UDYAM-[A-Z]{2}-\d{2}-\d{7})\b/i,
  frn: /\bFRN\s*(?:No\.?|Number)?\s*[:.\-]?\s*(\d{6}[A-Z])\b/i,
  din: /\bDIN\s*(?:No\.?)?\s*[:.\-]?\s*(\d{8})\b/i,
};

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");

// "15/04/2012", "15-04-2012", "15.04.2012", "15 April 2012", "2012-04-15" → "2012-04-15"
export function isoDate(s) {
  const t = String(s || "").trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/);
  if (m && +m[2] <= 12 && +m[1] <= 31) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  m = t.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3})[a-z]*,?\s+(\d{4})/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(m[1])}`;
  return null;
}

// "FY 2024-25", "2024-25", "FY2024-2025", "31.03.2025", "March 2025", "AY 2025-26" → "FY 2024-25"
export function fyOf(s) {
  const t = String(s || "").trim();
  let m = t.match(/AY\s*(\d{4})\s*[-–/]\s*(\d{2,4})/i);
  if (m) { const y = +m[1] - 1; return `FY ${y}-${String(y + 1).slice(2)}`; }
  m = t.match(/(\d{4})\s*[-–/]\s*(\d{2,4})/);
  if (m && (+String(m[2]).slice(-2) === (+m[1] + 1) % 100)) return `FY ${m[1]}-${String(+m[1] + 1).slice(2)}`;
  const d = isoDate(t);
  const y = d ? +d.slice(0, 4) : +(t.match(/\b(20\d{2})\b/) || [])[1];
  const mo = d ? +d.slice(5, 7) : (MONTHS[(t.match(/\b([A-Za-z]{3})[a-z]*\b/) || [])[1]?.toLowerCase()] || 3);
  if (!y) return null;
  const start = mo <= 3 ? y - 1 : y;
  return `FY ${start}-${String(start + 1).slice(2)}`;
}

// 42500000, "4,25,00,000", "₹ 4.25 Cr", "425.00 lakh", "Rs. 3,68,00,000/-" → rupees
export function amount(v) {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : null;
  const t = String(v || "").replace(/₹|rs\.?|inr|\/-/gi, "").trim();
  const m = t.match(/(-?[\d,]*\.?\d+)\s*(crores?|cr\.?|lakhs?|lacs?|l\b|thousand|k\b)?/i);
  if (!m) return null;
  let n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  const u = (m[2] || "").toLowerCase();
  if (/^cr/.test(u)) n *= 1e7; else if (/^(lakh|lac|l$)/.test(u)) n *= 1e5; else if (/^(thousand|k$)/.test(u)) n *= 1e3;
  return Math.round(n);
}

const CONSTITUTIONS = [
  [/limited liability partnership|\bLLP\b/i, "llp"], [/one person company|\bOPC\b/i, "opc"], [/private limited|pvt\.? ltd/i, "private_limited"],
  [/public limited|\blimited company\b/i, "public_limited"], [/partnership/i, "partnership"], [/proprietor/i, "proprietorship"], [/trust|society/i, "trust"],
];
export function constitutionOf(s) { const hit = CONSTITUTIONS.find(([rx]) => rx.test(String(s || ""))); return hit ? hit[1] : null; }

const line = (text, label) => {
  const m = String(text).match(new RegExp(`${label}\\s*[:\\-]?\\s*([^\\n]{2,160})`, "i"));
  return m ? m[1].replace(/\s{2,}.*$/, "").trim() : null;
};

// The free reader: what patterns can take from typed text.
export function freeRead(type, text = "") {
  const t = String(text);
  const out = { company: {}, document: {}, facts: [], people: [], works: [] };
  const g = t.match(RX.gstin)?.[1];
  const pan = t.match(RX.pan)?.[1] || (g ? g.slice(2, 12) : null);
  const cin = t.match(RX.cin)?.[1];
  const udyam = t.match(RX.udyam)?.[1]?.toUpperCase();
  if (type === "REG-GST" && g) {
    out.company.gstin = g; out.company.pan = g.slice(2, 12); out.document.number = g;
    const legal = line(t, "Legal Name(?: of Business)?"); if (legal) out.company.legal_name = legal;
    const trade = line(t, "Trade Name(?:, if any)?"); if (trade && !/^(n\.?a\.?|nil|-)$/i.test(trade)) out.company.trade_name = trade;
    const cons = constitutionOf(line(t, "Constitution of Business")); if (cons) out.company.constitution = cons;
    const addr = line(t, "Address of Principal Place of\\s*Business"); if (addr) out.company.registered_address = addr;
    const from = isoDate(line(t, "Date of Liability") || ""); if (from) out.document.issued_on = from;
  } else if (type === "REG-PAN" && pan) {
    out.company.pan = pan; out.document.number = pan;
  } else if (type === "REG-UDYAM" && udyam) {
    out.company.udyam_no = udyam; out.document.number = udyam;
    const cat = (t.match(/\b(MICRO|SMALL|MEDIUM)\b/) || [])[1]; if (cat) out.company.msme_category = cat.toLowerCase();
    const inc = isoDate(line(t, "Date of (?:Incorporation|Commencement)[^:\\n]*") || ""); if (inc) out.company.incorporation_date = inc;
  } else if (type === "REG-INC" && (cin || t.match(RX.llpin))) {
    if (cin) { out.company.cin = cin; out.document.number = cin; }
    const inc = isoDate((t.match(/(?:incorporated|registered)[^.]{0,80}?(?:on|this)\s+([^.\n]{6,30})/i) || [])[1] || ""); if (inc) { out.company.incorporation_date = inc; out.document.issued_on = inc; }
    if (cin) out.company.constitution = /^U\d{5}[A-Z]{2}\d{4}OPC/.test(cin) ? "opc" : /PLC/.test(cin) ? "public_limited" : "private_limited";
  } else if (type === "CERT-ICAI") {
    const frn = t.match(RX.frn)?.[1]; if (frn) out.document.number = frn;
  } else if (type === "CERT-PEER") {
    const until = isoDate(line(t, "valid (?:up ?to|till|until)") || ""); if (until) out.document.valid_until = until;
  }
  return out;
}

// Does the free reading leave work for AI? Financial statements, deeds, MoA / AoA, work orders and scanned copies do.
const AI_TYPES = new Set(["FIN-AUDIT", "FIN-ITR", "FIN-CA-CERT", "FIN-SOLV", "REG-MOA", "REG-INC", "LEG-POA", "EXP-WO", "EXP-CC", "PEOPLE-CV", "OTHER"]);
export function needsAi(type, free, textChars) {
  if (textChars < 200) return true; // a photo or scanned copy: only AI can read it
  if (type === "REG-INC") return !free.company.cin; // partnership deeds and LLP agreements have no CIN to find
  if (AI_TYPES.has(type)) return true;
  return Object.keys(free.company).length + Object.keys(free.document).length === 0;
}

export const FACT_KEYS = {
  "fin.turnover": "Turnover (revenue from operations)", "fin.total_income": "Total income", "fin.profit_after_tax": "Profit after tax",
  "fin.net_worth": "Net worth", "fin.share_capital": "Share / partners' capital", "fin.reserves": "Reserves and surplus",
  "fin.total_assets": "Total assets", "fin.borrowings": "Borrowings", "fin.solvency": "Solvency amount", "people.count.total": "Total employees",
};

const TYPE_HINT = {
  "FIN-AUDIT": "audited financial statements (balance sheet and profit & loss). Take every year shown (current and previous columns).",
  "FIN-ITR": "an income-tax return acknowledgement. Take the assessment year, gross total income and total income.",
  "FIN-CA-CERT": "a chartered accountant's certificate of turnover / net worth. Take every year it certifies.",
  "FIN-SOLV": "a bank solvency certificate. Take the solvency amount and the date.",
  "REG-MOA": "a Memorandum / Articles of Association. Take the company name, CIN, registered office, authorised and paid-up capital, subscribers and first directors with their shares.",
  "REG-INC": "an incorporation certificate, partnership deed or LLP agreement. Take the firm's name, constitution, date, registered office and every partner / director with their share.",
  "EXP-WO": "a work order / purchase order. Take the client, the work, the value and the dates.",
  "EXP-CC": "a completion / performance certificate. Take the client, the work, the value, the dates and whether it was completed.",
};

export function docPrompt(type, typeName) {
  return `You are reading a business document an Indian firm uploaded to its own records: ${TYPE_HINT[type] || `a "${typeName || type}".`}
It may be in English or Hindi; answer in English. Return ONE JSON object (null or [] when the document does not say):
{
 "document": {"title": string, "number": string (certificate / registration / reference no.), "issued_on": "YYYY-MM-DD", "valid_until": "YYYY-MM-DD", "period": "FY 2024-25" style},
 "company": {"legal_name", "trade_name", "constitution": one of proprietorship|partnership|llp|private_limited|public_limited|opc|trust, "pan", "gstin", "cin", "udyam_no", "msme_category": micro|small|medium, "incorporation_date": "YYYY-MM-DD", "registered_address", "city", "state", "pincode"},
 "facts": [{"key": one of ${Object.keys(FACT_KEYS).join(", ")}, "period": "FY 2024-25" (the financial year ending 31 March 2025), "value": number in rupees (convert lakh / crore; amounts in a "₹ in lakhs" statement must be multiplied)}],
 "people": [{"name", "role": director|partner|proprietor|shareholder|trustee|member|designated_partner|signatory|employee, "din", "pan", "share_pct": number, "qualification", "membership_no"}],
 "works": [{"client", "work_name", "value_inr": number, "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "status": completed|ongoing}],
 "summary": [up to 5 short lines on what the document shows]
}
Net worth = share / partners' capital + reserves (total equity). Turnover = revenue from operations (not other income).
Use only what the document says. Do not invent numbers.`;
}

const str = (v, n = 200) => (v === null || v === undefined ? null : String(v).replace(/\s+/g, " ").trim().slice(0, n) || null);
const ROLE = { director: "Director", partner: "Partner", proprietor: "Proprietor", shareholder: "Shareholder", trustee: "Trustee", member: "Member", designated_partner: "Designated Partner", signatory: "Authorised signatory", employee: null };

// AI output (or free output) → one clean shape
export function cleanExtract(raw = {}) {
  const c = raw.company || {}, d = raw.document || {};
  const company = {};
  for (const k of ["legal_name", "trade_name", "registered_address", "city", "state"]) if (str(c[k])) company[k] = str(c[k], k === "registered_address" ? 300 : 160);
  const pan = str(c.pan)?.toUpperCase(); if (pan && /^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) company.pan = pan;
  const gstin = str(c.gstin)?.toUpperCase(); if (gstin && RX.gstin.test(gstin)) company.gstin = gstin;
  const cin = str(c.cin)?.toUpperCase(); if (cin && RX.cin.test(cin)) company.cin = cin;
  const ud = str(c.udyam_no)?.toUpperCase(); if (ud && RX.udyam.test(ud)) company.udyam_no = ud;
  const pin = str(c.pincode)?.replace(/\D/g, ""); if (pin && /^\d{6}$/.test(pin)) company.pincode = pin;
  const cons = ["proprietorship", "partnership", "llp", "private_limited", "public_limited", "opc", "trust"].includes(c.constitution) ? c.constitution : constitutionOf(c.constitution);
  if (cons) company.constitution = cons;
  if (["micro", "small", "medium"].includes(String(c.msme_category || "").toLowerCase())) company.msme_category = String(c.msme_category).toLowerCase();
  const inc = isoDate(c.incorporation_date); if (inc) company.incorporation_date = inc;
  const document = {};
  if (str(d.title)) document.title = str(d.title, 120);
  if (str(d.number)) document.number = str(d.number, 80);
  if (isoDate(d.issued_on)) document.issued_on = isoDate(d.issued_on);
  if (isoDate(d.valid_until)) document.valid_until = isoDate(d.valid_until);
  if (fyOf(d.period)) document.period = fyOf(d.period);
  const facts = (Array.isArray(raw.facts) ? raw.facts : []).map((f) => ({ key: f?.key, period: f?.key === "people.count.total" ? "" : fyOf(f?.period), value: amount(f?.value) }))
    .filter((f) => FACT_KEYS[f.key] && f.value !== null && f.value >= 0 && (f.period !== null)).slice(0, 40);
  const people = (Array.isArray(raw.people) ? raw.people : []).map((p) => ({
    name: str(p?.name, 120), designation: ROLE[String(p?.role || "").toLowerCase()] ?? str(p?.role, 60), din: (String(p?.din || "").match(/\d{8}/) || [])[0] || null,
    pan: /^[A-Z]{5}\d{4}[A-Z]$/.test(String(p?.pan || "").toUpperCase()) ? String(p.pan).toUpperCase() : null,
    share_pct: Number.isFinite(Number(p?.share_pct)) && Number(p.share_pct) > 0 && Number(p.share_pct) <= 100 ? Number(p.share_pct) : null,
    qualification: str(p?.qualification, 80), membership_no: str(p?.membership_no, 30),
  })).filter((p) => p.name && p.name.length > 2).slice(0, 40);
  const works = (Array.isArray(raw.works) ? raw.works : []).map((w) => ({
    client: str(w?.client, 160), work_name: str(w?.work_name, 300), value_inr: amount(w?.value_inr),
    start_date: isoDate(w?.start_date), end_date: isoDate(w?.end_date), status: w?.status === "ongoing" ? "ongoing" : "completed",
  })).filter((w) => w.client && w.work_name).slice(0, 20);
  const summary = (Array.isArray(raw.summary) ? raw.summary : []).map((s) => str(s, 200)).filter(Boolean).slice(0, 5);
  return { company, document, facts, people, works, summary };
}

// merge free and AI results: AI fills what the free reader did not find
export function mergeExtract(free, ai) {
  if (!ai) return free;
  return { company: { ...ai.company, ...free.company }, document: { ...ai.document, ...free.document }, facts: ai.facts || [], people: ai.people || [], works: ai.works || [], summary: ai.summary || [] };
}

const norm = (s) => String(s || "").toLowerCase().replace(/^(mr|mrs|ms|dr|ca|cs|cma|shri|smt|sri)\.?\s+/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const same = (a, b) => String(a ?? "").trim().toLowerCase().replace(/\s+/g, " ") === String(b ?? "").trim().toLowerCase().replace(/\s+/g, " ");

// What goes into the masters, given what the Vault already holds. Never overwrites: a different value is a conflict.
export function planApply(ex, vault = {}) {
  const company = {}, conflicts = [];
  for (const [k, v] of Object.entries(ex.company || {})) {
    const cur = vault.company?.[k];
    if (cur === null || cur === undefined || cur === "") company[k] = v;
    else if (!same(cur, v)) conflicts.push({ kind: "company", field: k, vault: cur, doc: v });
  }
  const facts = [];
  for (const f of ex.facts || []) {
    const cur = (vault.facts || []).find((x) => x.key === f.key && (x.period || "") === (f.period || ""));
    if (!cur) facts.push(f);
    else if (Number(cur.value) !== f.value) conflicts.push({ kind: "fact", field: f.key, period: f.period, vault: cur.value, doc: f.value });
  }
  const peopleAdd = [], peopleUpdate = [];
  for (const p of ex.people || []) {
    const cur = (vault.people || []).find((x) => norm(x.name) === norm(p.name));
    if (!cur) { if (!peopleAdd.some((x) => norm(x.name) === norm(p.name))) peopleAdd.push(p); continue; }
    const set = {};
    for (const k of ["designation", "din", "pan", "share_pct", "qualification", "membership_no"]) if (p[k] !== null && p[k] !== undefined && (cur[k] === null || cur[k] === undefined || cur[k] === "")) set[k] = p[k];
    if (Object.keys(set).length) peopleUpdate.push({ id: cur.id, name: cur.name, set });
  }
  const worksAdd = (ex.works || []).filter((w) => !(vault.works || []).some((x) => norm(x.work_name) === norm(w.work_name) && norm(x.client) === norm(w.client)));
  const count = Object.keys(company).length + facts.length + peopleAdd.length + peopleUpdate.length + worksAdd.length;
  return { company, facts, peopleAdd, peopleUpdate, worksAdd, conflicts, count };
}

const LABEL = { legal_name: "Legal name", trade_name: "Trade name", constitution: "Constitution", pan: "PAN", gstin: "GSTIN", cin: "CIN", udyam_no: "Udyam no.", msme_category: "MSME category", incorporation_date: "Incorporation date", registered_address: "Registered address", city: "City", state: "State", pincode: "PIN code" };
export const fieldLabel = (k) => LABEL[k] || FACT_KEYS[k] || k;
const lakh = (n) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(2)} L` : `₹${Number(n).toLocaleString("en-IN")}`);

// short lines for the person: what was added
export function applyLines(plan) {
  const out = [];
  for (const [k, v] of Object.entries(plan.company || {})) out.push(`${fieldLabel(k)}: ${v}`);
  for (const f of plan.facts || []) out.push(`${fieldLabel(f.key)}${f.period ? ` ${f.period}` : ""}: ${f.key.startsWith("fin.") ? lakh(f.value) : f.value}`);
  for (const p of plan.peopleAdd || []) out.push(`${p.designation || "Person"}: ${p.name}${p.share_pct ? ` (${p.share_pct}%)` : ""}`);
  for (const p of plan.peopleUpdate || []) out.push(`${p.name}: ${Object.keys(p.set).join(", ")} added`);
  for (const w of plan.worksAdd || []) out.push(`Work: ${w.work_name} — ${w.client}${w.value_inr ? `, ${lakh(w.value_inr)}` : ""}`);
  return out;
}
