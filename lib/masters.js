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

// The crux of a question, so the same question in other words finds the saved answer (owner, 2 Nov: "understand the
// crux and only ask if there is a difference"): abbreviations spelled out, synonyms folded to one word, simple plurals and
// endings dropped, filler words removed. What makes two questions really different — numbers ("last 3 years" vs "last 5
// years"), a state, average / total / minimum — must then be the same on both sides.
const ABBR = [[/\bno\.?(?=\s|$)|\bnos?\b|\bnum\b/g, "number"], [/\bregn\.?|\breg\.?(?=\s|$)/g, "registration"], [/\byrs?\b/g, "years"], [/\bcert\b/g, "certificate"],
  [/\baddr\b/g, "address"], [/\b(tel|mob|mobile|telephone|contact number)\b/g, "phone"], [/\bemp\b/g, "employees"], [/\bqty\b/g, "quantity"], [/\bamt\b/g, "amount"],
  [/\bdob\b/g, "date birth"], [/\bapprox\b/g, "approximate"], [/\bfy\b/g, "financial year"], [/\bp\.?a\.?(?=\s|$)/g, "per annum"]];
const SYN = { firm: "bidder", company: "bidder", agency: "bidder", organisation: "bidder", organization: "bidder", tenderer: "bidder", contractor: "bidder",
  applicant: "bidder", vendor: "bidder", supplier: "bidder", concern: "bidder", entity: "bidder", enterprise: "bidder", business: "bidder",
  staff: "staff", employee: "staff", employees: "staff", manpower: "staff", personnel: "staff", workforce: "staff", worker: "staff", workers: "staff",
  turnover: "turnover", revenue: "turnover", sales: "turnover", receipts: "turnover", certificate: "certificate", certification: "certificate",
  license: "licence", licence: "licence", registered: "registration", registration: "registration", enrolment: "registration", enrollment: "registration",
  established: "established", establishment: "established", incorporation: "established", incorporated: "established", inception: "established", formation: "established", founded: "established",
  experience: "experience", experienced: "experience", similar: "similar", identical: "similar", completed: "completed", executed: "completed",
  owner: "proprietor", proprietor: "proprietor", head: "head", office: "office", premises: "office", branch: "branch", branches: "branch" };
const STOP = new Set(["the", "and", "for", "with", "your", "our", "its", "his", "her", "their", "this", "that", "these", "those", "please", "kindly", "provide", "mention",
  "enter", "give", "state", "furnish", "specify", "indicate", "whether", "any", "all", "each", "has", "have", "had", "been", "being", "are", "was", "were", "will", "shall",
  "should", "may", "can", "from", "into", "upon", "under", "over", "about", "name", "details", "detail", "particulars", "applicable", "if", "of", "in", "on", "at", "to", "by",
  "as", "is", "be", "or", "an", "a", "no", "yes", "not", "per", "also", "etc", "said", "above", "below", "here", "there", "which", "what", "who", "when", "where", "how", "do", "does", "did"]);
const stem = (w) => (SYN[w] ? SYN[w] : w.length > 5 && w.endsWith("ies") ? `${w.slice(0, -3)}y` : w.length > 4 && w.endsWith("es") && !w.endsWith("ses") ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w.length > 6 && w.endsWith("ing") ? w.slice(0, -3) : w);
export function crux(label) {
  let t = String(label || "").toLowerCase().replace(/&/g, " and ");
  for (const [re, to] of ABBR) t = t.replace(re, ` ${to} `);
  const raw = t.replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  const nums = raw.filter((w) => /^\d+$/.test(w)).map(Number).concat(raw.map((w) => ({ one: 1, two: 2, three: 3, four: 4, five: 5, seven: 7, ten: 10 })[w]).filter(Boolean));
  // "bidder" (firm, company, agency…) says nothing: almost every question is about the bidder
  const toks = new Set(raw.filter((w) => !/^\d+$/.test(w) && !STOP.has(w) && w.length > 1).map((w) => SYN[w] || stem(w)).map((w) => SYN[w] || w).filter((w) => !WEAK.has(w)));
  return { toks, nums: [...new Set(nums)].sort((a, b) => a - b).join(","), quals: [...toks].filter((w) => QUALS.has(w)).sort().join(","), places: STATE_WORDS.filter((st) => t.includes(st)).join(",") };
}
const WEAK = new Set(["bidder", "roll", "payroll", "rolls", "own", "present", "presently", "currently", "existing", "respect", "regard", "being", "record"]);
const QUALS = new Set(["average", "total", "aggregate", "cumulative", "minimum", "maximum", "annual", "monthly", "current", "previous", "last", "net", "gross", "proprietor", "partner", "director", "branch", "head"]);
const STATE_WORDS = ["andhra", "arunachal", "assam", "bihar", "chhattisgarh", "goa", "gujarat", "haryana", "himachal", "jharkhand", "karnataka", "kerala", "madhya pradesh", "maharashtra", "manipur", "meghalaya", "mizoram", "nagaland", "odisha", "punjab", "rajasthan", "sikkim", "tamil", "telangana", "tripura", "uttar pradesh", "uttarakhand", "bengal", "delhi", "kashmir", "ladakh", "puducherry", "chandigarh"];

// How alike two questions are, 0..1 (0 when a number, a state or a qualifier differs).
export function sameQuestion(a, b) {
  const x = typeof a === "string" ? crux(a) : a, y = typeof b === "string" ? crux(b) : b;
  if (x.nums !== y.nums || x.places !== y.places || x.quals !== y.quals) return 0;
  if (!x.toks.size || !y.toks.size) return 0;
  const common = [...x.toks].filter((w) => y.toks.has(w)).length;
  return (2 * common) / (x.toks.size + y.toks.size); // Dice: "No. of employees" ≈ "Number of staff on the rolls"
}

// A saved master fact that answers this label: same key, or the same question in other words.
// blanks that belong to one tender (dates, numbers, amounts, page refs): kept on the tender, never in the Vault
export const PER_TENDER = /(^|\b)(date|dated|place|tender (no|ref|id|number)|nit|name of (the )?work|page( no)?|amount|price|rates?|quoted|fee in|dd\b|demand draft|bank guarantee|\bbg\b|emd (no|detail|amount)|utr|transaction|y\/n|yes\/no|enclosed|unit bid|cluster|district|sl\.? ?no|s\.? ?no|serial)/i;

export function matchFact(label, facts) {
  if (PER_TENDER.test(String(label))) return null; // never another tender's date, number or amount
  const key = labelKey(label);
  const exact = facts.find((f) => f.key === key && !blank(f.value));
  if (exact) return exact;
  const want = crux(label);
  if (want.toks.size < 2) return null;
  let best = null, bestScore = 0;
  for (const f of facts) {
    if (!f.key.startsWith("master.") || blank(f.value)) continue;
    const score = sameQuestion(want, crux(f.key.slice(7).replace(/_/g, " ")));
    if (score > bestScore) { best = f; bestScore = score; }
  }
  return bestScore >= 0.67 ? best : null;
}

// Blanks the Vault or the tender already answers, by what they ask for (checked before any saved answer).
const CONS = { proprietorship: "Proprietorship", partnership: "Partnership firm", llp: "Limited Liability Partnership", private_limited: "Private Limited Company", public_limited: "Public Limited Company", opc: "One Person Company", trust: "Trust / Society" };
const ALIASES = [
  [/\bgstin?\b|gst (registration )?(no|number)/, (c) => c.company?.gstin], [/\bpan\b(?!.*partner)/, (c) => c.company?.pan], [/\bcin\b|corporate identity|llpin/, (c) => c.company?.cin],
  [/udyam|msme reg|udyog aadhaar/, (c) => c.company?.udyam_no], [/(name of|legal name of) (the )?(bidder|tenderer|firm|company|agency|applicant)|bidder'?s? name|firm'?s? name|^(the )?(bidder|tenderer|firm|company|agency|applicant)$/, (c) => c.company?.legal_name],
  [/constitution|legal status|type of (firm|entity|organi[sz]ation)/, (c) => CONS[c.company?.constitution]], [/registered (office )?address|address of (the )?(bidder|firm|company|registered office)|^address$/, (c) => [c.company?.registered_address, c.company?.city, c.company?.state, c.company?.pincode].filter(Boolean).join(", ") || null],
  [/e-?mail/, (c) => c.company?.email], [/(phone|mobile|telephone|contact) (no|number)|^phone$|^mobile$/, (c) => c.company?.phone || c.company?.signatory_mobile], [/website/, (c) => c.company?.website],
  [/name of (the )?(authori[sz]ed )?signatory|signatory'?s? name|authori[sz]ed (person|representative)/, (c) => c.company?.signatory_name], [/designation of (the )?(authori[sz]ed )?signatory|signatory'?s? designation/, (c) => c.company?.signatory_designation],
  [/ifsc/, (c) => c.company?.bank_ifsc], [/bank (name|and branch)|name of (the )?bank/, (c) => c.company?.bank_name], [/(bank )?a\/?c(count)? (no|number)|account number/, (c) => c.company?.bank_account],
  [/date of (incorporation|registration|establishment)|year of (establishment|incorporation)/, (c) => c.company?.incorporation_date], [/years? in (business|existence|operation)/, (c) => c.company?.incorporation_date ? String(Math.floor((Date.now() - new Date(c.company.incorporation_date)) / 31557600000)) : null],
  [/(tender|nit|bid) (no|number|ref|reference|id)/, (c) => c.tender?.tender_ref], [/name of (the )?(work|assignment|project)|title of (the )?(tender|work)/, (c) => c.tender?.title], [/tender(ing)? (inviting )?authority|name of (the )?(department|organi[sz]ation|employer|client)/, (c) => c.tender?.authority || c.tender?.department],
  // place / date of signing: the company's city (brief §2.6 — was asked on every tender), today's date
  [/^(place|station|place of (signing|execution|declaration))\s*:?$/, (c) => c.company?.city || c.company?.state], [/^(date|dated)\s*:?$/, () => new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })],
];
export function aliasValue(label, ctx = {}) {
  const l = String(label).toLowerCase().trim();
  for (const [re, get] of ALIASES) if (re.test(l)) { const v = get(ctx); if (v !== null && v !== undefined && v !== "") return String(v); }
  return null;
}

// Placeholders the AI left in a filled format.
export const placeholders = (text) => [...new Set([...String(text || "").matchAll(/\[TO BE FILLED:\s*([^\]]{2,120})\]/gi)].map((m) => m[1].trim()))];

// What a blank left by the AI is. "junk": the page is not a form (notice, terms, schedule); "people"/"works": a table
// built from Key people / Experience; "partner": one partner's detail (n = 1, 2, ...); "fact": a plain master answer.
// A detail without a partner number ("ICAI Membership No.") belongs to the partner named just before it.
export function classifyBlanks(text) {
  let lastPartner = null;
  return placeholders(text).length ? [...String(text).matchAll(/\[TO BE FILLED:\s*([^\]]{2,120})\]/gi)].map((m) => {
    const label = m[1].trim(), l = label.toLowerCase();
    if (/not provided|not available in|no format|template not|not applicable|reference only/.test(l)) return { label, type: "junk" };
    // the system adds the signature block; a signature, seal or thumb blank is never a question
    if (/^(signature|seal|stamp|thumb|witness)|signature of|\bseal of|rubber stamp/.test(l)) return { label, type: "junk" };
    const field = /\bpan\b/.test(l) ? "pan" : /membership|icai|m\.? ?no/.test(l) ? "membership_no" : /qualif/.test(l) ? "qualification" : /experience|years/.test(l) ? "years_experience" : /designation/.test(l) ? "designation" : /name/.test(l) ? "name" : null;
    const n = l.match(/partner\s*(?:no\.?\s*)?(\d)/);
    if (n && field) { lastPartner = Number(n[1]); return { label, type: "partner", n: lastPartner, field }; }
    if (/\btable\b|list of|details of (all|each)/.test(l)) return { label, type: /partner|employee|staff|professional|personnel|\bca\b|chartered|qualified|team|member/.test(l) ? "people" : "works" };
    if (lastPartner && field && field !== "name" && !/firm|company|business|bidder|incorporat|agency|organi[sz]ation/.test(l)) return { label, type: "partner", n: lastPartner, field };
    return { label, type: "fact" };
  }) : [];
}

// Partners first (partner / proprietor / director in the designation), then everyone else, as entered.
const isPartner = (p) => /partner|proprietor|director/i.test(p.designation || "");
export const partners = (people = []) => [...people].sort((a, b) => Number(isPartner(b)) - Number(isPartner(a)));
// "Partner 1, 2, ..." in a format: only people who are partners, proprietors or directors.
export const partnerList = (people = []) => people.filter(isPartner);

// A partner's detail kept as a master fact (when Key people has no partners): "ICAI No. of Partner 2" is its own
// answer; partner 1 may also use the plain label.
export const partnerLabel = (b) => (/partner/i.test(b.label) ? b.label : `${b.label} of Partner ${b.n}`);
export function partnerFact(b, facts) {
  const key = labelKey(partnerLabel(b));
  return facts.find((f) => f.key === key && !blank(f.value)) || (b.n === 1 ? matchFact(b.label, facts) : null);
}

const tableOf = (type, people, works) => type === "people"
  ? partners(people).map((p, i) => `${i + 1}. ${p.name}${p.designation ? `, ${p.designation}` : ""}${p.qualification ? ` (${p.qualification})` : ""}${p.membership_no ? `, Membership No. ${p.membership_no}` : ""}${p.years_experience != null ? `, ${p.years_experience} years` : ""}`).join("\n")
  : works.filter((w) => w.status === "completed" || w.status == null).map((w, i) => `${i + 1}. ${w.work_name} - ${w.client}${w.work_order_no ? `, W.O. ${w.work_order_no}` : ""}${w.value_inr ? `, Rs. ${Number(w.value_inr).toLocaleString("en-IN")}` : ""}${w.start_date ? `, ${w.start_date} to ${w.end_date || "…"}` : w.end_date ? `, completed ${w.end_date}` : ""}${w.scope ? ` (${w.scope})` : ""}`).join("\n");

// A filled format with nothing for the bidder in it: the tender's notice, terms or schedule.
export const isReference = (text) => String(text || "").includes("[REFERENCE ONLY]") || (classifyBlanks(text).length > 0 && classifyBlanks(text).every((b) => b.type === "junk") && String(text).replace(/\[TO BE FILLED:[^\]]*\]/gi, "").trim().length < 200);

// Put saved master answers into the placeholders: partner details and tables from Key people / Experience,
// then master facts. Blanks that are not blanks (junk) disappear; anything still unknown stays visible.
export function fillPlaceholders(text, facts, { people = [], works = [], company = null, tender = null } = {}) {
  text = normaliseBlanks(text);
  const blanks = classifyBlanks(text);
  let i = 0;
  return String(text || "").replace(/\[TO BE FILLED:\s*([^\]]{2,120})\]/gi, (all, label) => {
    const b = blanks[i++] || { type: "fact", label: label.trim() };
    if (b.type === "junk") return "";
    if (b.type === "partner") { const p = partnerList(people)[b.n - 1]; const v = p?.[b.field]; if (v != null && v !== "") return String(v); return partnerFact(b, facts)?.value ?? all; }
    if (b.type === "people" || b.type === "works") { const t = tableOf(b.type, people, works); if (t) return `\n${t}\n`; }
    return aliasValue(b.label, { company, tender }) ?? matchFact(b.label, facts)?.value ?? all;
  });
}

// The tender's own blanks — form-field markers [___12___], underscores, dotted lines, empty ( ) boxes — become
// [TO BE FILLED: label], the label taken from the words just before the blank on the same line.
export function normaliseBlanks(text) {
  let inTable = false;
  return String(text || "").split("\n").map((line) => {
    if (/⟦table/.test(line)) inTable = true;
    if (/⟦\/table⟧/.test(line)) { inTable = false; return line; }
    if (inTable || /⟦/.test(line)) return line;
    return line.replace(/(\[_{2,}\d*_{2,}\]|_{4,}|\.{5,}|…{2,}|\(\s{0,3}\)|\[\s{0,3}\])/g, (m, _b, off) => {
      const before = line.slice(0, off).replace(/\[TO BE FILLED:[^\]]*\]/g, "").replace(/[\s:\-–=]+$/, "").split(/[:;,(]|\s-\s/).pop().replace(/^[\s\d.)]+/, "").trim();
      const label = before.length >= 2 ? before.slice(-60) : "details";
      return `[TO BE FILLED: ${label}]`;
    });
  }).join("\n");
}
