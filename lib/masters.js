// Master questions: everything a tender format needs is asked once, one question at a time, and saved to the
// company's masters (company record, Facts, works, people) so no later tender asks it again. Only the price is
// asked per tender. Pure functions: run in server actions and in `node --test`.

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/, GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/, IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const CONSTITUTIONS = { proprietorship: "Proprietorship", partnership: "Partnership firm", llp: "LLP", private_limited: "Private Limited Company", public_limited: "Public Limited Company", opc: "One Person Company", trust: "Trust", society: "Society", other: "Other" };

// Company record fields, in the order they are asked.
export const FIELDS = {
  legal_name: { q: "What is your firm's full legal name (as on PAN)?", label: "Legal name" },
  constitution: { q: "What kind of entity is it?", label: "Constitution", options: CONSTITUTIONS },
  pan: { q: "What is the firm's PAN?", label: "PAN", hint: "ABCDE1234F", upper: true, check: (v) => PAN.test(v) || "PAN should look like ABCDE1234F." },
  gstin: { q: "What is the GSTIN?", label: "GSTIN", hint: "07ABCDE1234F1Z5", upper: true, check: (v) => GSTIN.test(v) || "GSTIN should be 15 characters, e.g. 07ABCDE1234F1Z5." },
  incorporation_date: { q: "When was the firm incorporated / registered?", label: "Date of incorporation", type: "date" },
  registered_address: { q: "What is the registered office address?", label: "Registered address", long: true },
  city: { q: "Which city is the registered office in?", label: "City" },
  state: { q: "Which state is the registered office in?", label: "State" },
  pincode: { q: "And its pincode?", label: "Pincode", check: (v) => /^[1-9][0-9]{5}$/.test(v) || "Pincode should be 6 digits." },
  email: { q: "Which email should tender authorities write to?", label: "Email", type: "email", check: (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) || "That does not look like an email." },
  phone: { q: "And the office phone number?", label: "Phone", type: "tel" },
  signatory_name: { q: "Who signs the bids (authorised signatory)? Full name, please.", label: "Signatory name" },
  signatory_designation: { q: "What is the signatory's designation?", label: "Signatory designation", hint: "Partner / Director / Proprietor" },
  signatory_mobile: { q: "The signatory's mobile number?", label: "Signatory mobile", type: "tel", check: (v) => /^\+?[0-9 -]{10,15}$/.test(v) || "Enter a 10-digit mobile number." },
  bank_name: { q: "Which bank should EMD refunds go to? Bank name and branch.", label: "Bank" },
  bank_account: { q: "The account number for EMD refunds?", label: "Bank account" },
  bank_ifsc: { q: "And that branch's IFSC?", label: "IFSC", hint: "HDFC0001234", upper: true, check: (v) => IFSC.test(v) || "IFSC should look like HDFC0001234." },
  udyam_no: { q: "Is the firm registered under Udyam (MSME)? If yes, the Udyam number; if not, type No.", label: "Udyam number", hint: "UDYAM-HR-01-0000001 or No" },
  msme_category: { q: "Which Udyam category is the firm in?", label: "MSME category", options: { micro: "Micro", small: "Small", medium: "Medium" } },
};

// What each format needs from the masters.
export const NEEDS = {
  covering_letter: ["legal_name", "signatory_name", "signatory_designation", "city"],
  bidder_info: ["legal_name", "constitution", "incorporation_date", "registered_address", "city", "state", "pincode", "pan", "gstin", "email", "phone", "signatory_name", "signatory_designation", "signatory_mobile", "bank_name", "bank_account", "bank_ifsc", "udyam_no", "msme_category"],
  turnover: ["legal_name", "signatory_name", "signatory_designation", "fin.turnover", "fin.net_worth"],
  similar_works: ["legal_name", "signatory_name", "signatory_designation", "works"],
  key_personnel: ["legal_name", "signatory_name", "signatory_designation", "people"],
  non_blacklisting: ["legal_name", "signatory_name", "signatory_designation"],
  mse: ["legal_name", "udyam_no", "msme_category", "signatory_name", "signatory_designation"],
  custom: ["legal_name", "signatory_name", "signatory_designation"],
  price: [],
  manual: [],
};

// Last three completed financial years, newest first: "FY 2025-26", ...
export function lastFys(now = new Date()) {
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return [1, 2, 3].map((k) => `FY ${start - k}-${String(start - k + 1).slice(2)}`);
}

// Validate and tidy one answer for a company field. Returns { value } or { error }.
export function checkField(field, raw) {
  const def = FIELDS[field];
  if (!def) return { error: "Unknown question." };
  let v = String(raw ?? "").trim().replace(/\s+/g, def.long ? " " : " ");
  if (!v) return { error: "Type an answer, or skip for now." };
  if (def.upper) v = v.toUpperCase();
  if (field === "udyam_no" && /^(no|none|nil|na|n\/a|not registered)$/i.test(v)) return { value: "NO" };
  if (def.options && !def.options[v]) return { error: "Pick one of the options." };
  if (def.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { error: "Pick a date." };
  const ok = def.check ? def.check(v) : true;
  return ok === true ? { value: v } : { error: ok };
}

const blank = (v) => v === null || v === undefined || String(v).trim() === "";

// The questions still open for a set of chosen formats, in a sensible order, one entry per question.
// facts: [{key, period, value}], counts: { works, people }.
export function missingMasters(company, kinds, { facts = [], counts = {}, now = new Date() } = {}) {
  const want = new Set(kinds.flatMap((k) => NEEDS[k] || NEEDS.custom));
  const out = [];
  for (const [field, def] of Object.entries(FIELDS)) {
    if (!want.has(field) || !blank(company[field])) continue;
    if (field === "udyam_no" && company.msme_category === "none") continue;
    if (field === "msme_category" && (!want.has("udyam_no") || blank(company.udyam_no) || company.msme_category === "none")) continue;
    out.push({ id: `m:${field}`, kind: "master", field, say: def.q, label: def.label, hint: def.hint || "", options: def.options || null, type: def.type || "text", long: !!def.long });
  }
  if (want.has("fin.turnover")) {
    const have = new Set(facts.filter((f) => f.key === "fin.turnover" && !blank(f.value)).map((f) => f.period));
    for (const fy of lastFys(now)) if (!have.has(fy)) out.push({ id: `t:${fy}`, kind: "fact", key: "fin.turnover", period: fy, unit: "INR", type: "money", say: `What was the firm's turnover in ${fy}? (in rupees, as per audited accounts)`, label: `Turnover ${fy}` });
  }
  if (want.has("fin.net_worth")) {
    const fy = lastFys(now)[0];
    if (!facts.some((f) => f.key === "fin.net_worth" && !blank(f.value))) out.push({ id: "t:networth", kind: "fact", key: "fin.net_worth", period: fy, unit: "INR", type: "money", say: `What was the firm's net worth at the end of ${fy}? (in rupees)`, label: `Net worth ${fy}` });
  }
  if (want.has("works") && !counts.works) out.push({ id: "w:first", kind: "work", say: "Tell me about your best completed work of this kind — I'll keep it for every tender that asks for experience." });
  if (want.has("people") && !counts.people) out.push({ id: "p:first", kind: "person", say: "Who is your key person for this kind of work? I'll keep them for every tender that asks for key personnel." });
  return out;
}

// Blanks inside a tender's own format wording, filled by AI as "[TO BE FILLED: <what is needed>]", are master
// facts keyed on their wording, so the same blank in another tender reuses the answer.
export const labelKey = (label) => `master.${String(label).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60)}`;

const words = (s) => new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2 && !["the", "and", "for", "with", "your", "firm", "name", "details"].includes(w)));
// A saved master fact that answers this label: same key, or most of the same words.
export function matchFact(label, facts) {
  const key = labelKey(label);
  const exact = facts.find((f) => f.key === key && !blank(f.value));
  if (exact) return exact;
  const want = words(label);
  if (want.size < 2) return null;
  let best = null, bestScore = 0;
  for (const f of facts) {
    if (!f.key.startsWith("master.") || blank(f.value)) continue;
    const have = words(f.key.slice(7).replace(/_/g, " "));
    const common = [...want].filter((w) => have.has(w)).length;
    const score = common / Math.max(want.size, have.size);
    if (score > bestScore) { best = f; bestScore = score; }
  }
  return bestScore >= 0.75 ? best : null;
}

// Placeholders the AI left in a filled format.
export const placeholders = (text) => [...new Set([...String(text || "").matchAll(/\[TO BE FILLED:\s*([^\]]{2,120})\]/gi)].map((m) => m[1].trim()))];

// Put saved master answers into the placeholders.
export function fillPlaceholders(text, facts) {
  return String(text || "").replace(/\[TO BE FILLED:\s*([^\]]{2,120})\]/gi, (all, label) => matchFact(label.trim(), facts)?.value ?? all);
}
