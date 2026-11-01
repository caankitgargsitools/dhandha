// Credentials each kind of business is asked for in tenders (owner, 1 Nov 2026, Q11: "yes, and similarly for other
// businesses — learn it from fetched tenders and ask the user when they select their profession / services").
// Pure and tested. Each credential belongs to one or more industries (`sectors`, the same keys as SECTORS in
// lib/formatHarvest.js), has a question asked once (answer kept as the Vault fact `cred.<key>`), a pattern that finds the
// requirement in tender text, and — for counts — the number the tender asks for. What fetched tenders ask most often in
// each industry (SQL `credential_stats`, from `tender_reads.fields.credentials`) decides the order of the questions.
import { SECTORS } from "./formatHarvest.js";

const W = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, ten: 10, fifteen: 15, twenty: 20 };
const n = (s) => (s == null ? null : W[String(s).toLowerCase()] ?? (Number(String(s).replace(/,/g, "")) || null));
const NUM = "(\\d{1,4}|one|two|three|four|five|six|seven|eight|ten|fifteen|twenty)";
const rx = (s, f = "i") => new RegExp(s, f);

// kind: yesno | number | text. `need` (numbers): the capture group holding the count the tender asks for.
export const CREDENTIALS = [
  // Audit, CA & accounting (ICAI)
  { key: "icai_frn", sectors: ["audit"], kind: "text", label: "ICAI firm registration number (FRN)", ask: "Your firm's ICAI registration number (FRN)?", re: rx("\\bFRN\\b|firm registration (?:number|no)|registered with (?:the )?(?:ICAI|Institute of Chartered Accountants)") },
  { key: "firm_years", sectors: ["audit", "consultancy"], kind: "number", label: "Years since the firm was set up", ask: "How many years ago was the firm set up (as per ICAI / registration)?", re: rx(`(?:firm|practice|existence|establish\\w*)[^.]{0,60}?(?:at least|minimum(?: of)?|not less than)\\s+${NUM}\\s+years`), need: 1 },
  { key: "partners", sectors: ["audit"], kind: "number", label: "Partners", ask: "How many partners does the firm have?", re: rx(`${NUM}\\s+(?:full[- ]time\\s+)?(?:FCA\\s+)?partners`), need: 1 },
  { key: "fca_partners", sectors: ["audit"], kind: "number", label: "FCA partners", ask: "How many partners are FCAs (fellow members)?", re: rx(`${NUM}\\s+(?:full[- ]time\\s+)?FCA`), need: 1 },
  { key: "ca_count", sectors: ["audit"], kind: "number", label: "Chartered accountants (partners + paid CAs)", ask: "How many chartered accountants work in the firm (partners plus paid CAs)?", re: rx(`${NUM}\\s+(?:full[- ]time\\s+|qualified\\s+)?(?:chartered accountants|CAs)\\b`), need: 1 },
  { key: "disa_cisa", sectors: ["audit", "it"], kind: "number", label: "Members with DISA / CISA", ask: "How many partners / CAs hold DISA or CISA?", re: rx("\\b(?:DISA|CISA)\\b", "") },
  { key: "audit_staff", sectors: ["audit"], kind: "number", label: "Audit staff (articled + semi-qualified)", ask: "How many audit staff (articled and semi-qualified assistants) do you have?", re: rx(`${NUM}\\s+(?:articled|audit|semi[- ]qualified)\\s+(?:assistants|staff|clerks)`), need: 1 },
  { key: "cag_empanelled", sectors: ["audit"], kind: "yesno", label: "Empanelled with C&AG", ask: "Is the firm empanelled with the C&AG (Comptroller & Auditor General)?", re: rx("\\b(?:C\\s?&\\s?AG|CAG|Comptroller (?:and|&) Auditor General)\\b[^.]{0,60}?(?:empanel|panel|list)|empanel\\w*\\s+(?:with\\s+)?(?:the\\s+)?(?:office of (?:the\\s+)?)?(?:C\\s?&\\s?AG|CAG\\b|Comptroller)") },
  { key: "rbi_panel", sectors: ["audit"], kind: "yesno", label: "On RBI's bank audit panel", ask: "Is the firm on RBI's panel for bank (branch / central statutory) audits?", re: rx("(?:RBI|Reserve Bank)[^.]{0,60}?(?:panel|empanel)|(?:central statutory|statutory branch|branch) audit[^.]{0,40}?(?:panel|empanel)") },
  { key: "peer_review", sectors: ["audit"], kind: "yesno", label: "Valid ICAI peer review certificate", ask: "Does the firm hold a valid ICAI peer review certificate?", re: rx("peer[- ]review(?:ed)?\\s+(?:certificate|board|firm)") },
  // Civil works
  { key: "contractor_class", sectors: ["works", "electrical"], kind: "text", label: "Contractor registration (department and class)", ask: "Your contractor registration: which department and class (e.g. CPWD Class II, PWD A)?", re: rx("(?:registered|enlisted|enlistment)[^.]{0,80}?(?:class|category)[- ]?(?:I{1,3}V?|[A-E]|\\d)\\b|(?:class|category)[- ]?(?:I{1,3}|[A-E])\\s+(?:civil\\s+|electrical\\s+)?contractor") },
  { key: "engineers", sectors: ["works", "electrical", "consultancy"], kind: "number", label: "Engineers on your rolls", ask: "How many qualified engineers are on your rolls?", re: rx(`${NUM}\\s+(?:qualified\\s+|graduate\\s+|full[- ]time\\s+)?(?:civil\\s+|electrical\\s+|mechanical\\s+)?engineers?\\b`), need: 1 },
  { key: "own_machinery", sectors: ["works"], kind: "yesno", label: "Own plant and machinery", ask: "Do you own the plant and machinery usually asked for (mixer, roller, vibrator, shuttering…)?", re: rx("(?:own(?:ed)?|owns)\\s+(?:plant|machinery|equipment)|plant and machinery[^.]{0,40}?(?:owned|available)") },
  // Electrical
  { key: "electrical_licence", sectors: ["electrical"], kind: "text", label: "Electrical contractor licence", ask: "Your electrical contractor licence (state and class)?", re: rx("electrical (?:contractor'?s?\\s+)?licen[cs]e|licensed electrical contractor") },
  { key: "mnre_empanelled", sectors: ["electrical"], kind: "yesno", label: "MNRE / state nodal agency empanelment (solar)", ask: "Are you empanelled with MNRE or the state nodal agency for solar?", re: rx("(?:MNRE|nodal agency)[^.]{0,50}?(?:empanel|channel partner)") },
  // IT
  { key: "cmmi_level", sectors: ["it"], kind: "number", label: "CMMI level", ask: "Your CMMI level (0 if none)?", re: rx("CMMI[^.]{0,20}?(?:level|L|ML)\\s*-?\\s*(\\d)"), need: 1 },
  { key: "iso_27001", sectors: ["it"], kind: "yesno", label: "ISO 27001 (information security)", ask: "Do you hold ISO/IEC 27001?", re: rx("ISO\\s*/?\\s*(?:IEC\\s*)?27001") },
  { key: "iso_20000", sectors: ["it"], kind: "yesno", label: "ISO 20000 (IT service management)", ask: "Do you hold ISO/IEC 20000?", re: rx("ISO\\s*/?\\s*(?:IEC\\s*)?20000") },
  { key: "it_staff", sectors: ["it"], kind: "number", label: "Technical staff on rolls", ask: "How many technical (IT / software) staff are on your rolls?", re: rx(`${NUM}\\s+(?:technical|IT|software)\\s+(?:staff|professionals|personnel|manpower|resources)`), need: 1 },
  { key: "cert_in", sectors: ["it"], kind: "yesno", label: "CERT-In empanelled auditor", ask: "Are you CERT-In empanelled (security audits)?", re: rx("CERT[- ]?In[^.]{0,30}?empanel") },
  // Manpower, security & facility
  { key: "psara", sectors: ["manpower"], kind: "yesno", label: "PSARA licence (private security)", ask: "Do you hold a PSARA licence for private security?", re: rx("PSARA|Private Security Agenc(?:y|ies) \\(Regulation\\)") },
  { key: "labour_licence", sectors: ["manpower", "works", "catering"], kind: "yesno", label: "Labour licence (CLRA)", ask: "Do you hold a labour licence under the Contract Labour Act (CLRA)?", re: rx("labour licen[cs]e|\\bCLRA\\b|Contract Labour \\(Regulation") },
  { key: "epf_reg", sectors: ["manpower", "works", "catering", "transport"], kind: "yesno", label: "EPF registration", ask: "Is the firm registered with EPFO (PF code)?", re: rx("\\b(?:EPF|PF)\\s+(?:registration|code)\\b|Employees'? Provident Fund") },
  { key: "esi_reg", sectors: ["manpower", "works", "catering", "transport"], kind: "yesno", label: "ESIC registration", ask: "Is the firm registered with ESIC?", re: rx("\\bESIC?\\s+(?:registration|code)\\b|Employees'? State Insurance") },
  { key: "workforce", sectors: ["manpower"], kind: "number", label: "People on your payroll", ask: "How many people are on your payroll?", re: rx(`${NUM}\\s+(?:workers|employees|guards|personnel|manpower)\\s+on\\s+(?:its|their|the|own)\\s+(?:rolls|payroll)`), need: 1 },
  // Medical
  { key: "drug_licence", sectors: ["medical"], kind: "yesno", label: "Drug licence (wholesale / manufacturing)", ask: "Do you hold a drug licence (wholesale or manufacturing)?", re: rx("drug (?:licen[cs]e|manufacturing licen)|Form[- ]?(?:20B|21B|25|28)\\b") },
  { key: "who_gmp", sectors: ["medical"], kind: "yesno", label: "WHO-GMP certificate", ask: "Do you hold a WHO-GMP certificate?", re: rx("WHO[- ]?GMP") },
  { key: "nabl", sectors: ["medical"], kind: "yesno", label: "NABL accreditation (labs)", ask: "Is your lab NABL accredited?", re: rx("\\bNABL\\b", "") },
  { key: "nabh", sectors: ["medical"], kind: "yesno", label: "NABH accreditation (hospitals)", ask: "Is your hospital NABH accredited?", re: rx("\\bNABH\\b", "") },
  // Vehicles & transport
  { key: "fleet", sectors: ["transport"], kind: "number", label: "Vehicles you own", ask: "How many vehicles does the firm own?", re: rx(`(?:own(?:ing)?|having)\\s+(?:at least|minimum(?: of)?)?\\s*${NUM}\\s+(?:vehicles|buses|cars|trucks|taxis|ambulances)`), need: 1 },
  { key: "transport_permit", sectors: ["transport"], kind: "yesno", label: "Commercial / tourist permits", ask: "Do your vehicles have commercial / tourist permits?", re: rx("(?:tourist|commercial|all india|contract carriage) permit") },
  // Catering, food & printing
  { key: "fssai", sectors: ["catering"], kind: "yesno", label: "FSSAI licence", ask: "Do you hold an FSSAI licence?", re: rx("FSSAI", "") },
  // Supply of goods
  { key: "bis_licence", sectors: ["supply", "electrical"], kind: "yesno", label: "BIS licence / ISI mark", ask: "Do your products carry a BIS licence / ISI mark?", re: rx("BIS (?:licen[cs]e|certification|registration)|ISI mark") },
];
export const CRED = Object.fromEntries(CREDENTIALS.map((c) => [c.key, c]));

const flat = (t) => String(t || "").replace(/\s+/g, " ");

// What a tender asks: [{ key, need, text }]
export function findCredentials(text) {
  const t = flat(text);
  const out = [];
  for (const c of CREDENTIALS) {
    const m = t.match(c.re);
    if (!m) continue;
    out.push({ key: c.key, need: c.need ? n(m[c.need]) : null, text: m[0].slice(0, 160) });
  }
  return out;
}

// The industries a firm works in, from its chosen services (catalogue index entries) — every SECTORS pattern that
// any service, sub-industry or industry name matches, plus the pack's own.
const PACK = { construction: "works", goods_supply: "supply", it_services: "it", ca_audit: "audit" };
export function firmSectors(services = []) {
  const set = new Set();
  for (const s of services) {
    const text = `${s.industry || ""} ${s.sub || ""} ${s.label || ""}`;
    for (const [k, v] of Object.entries(SECTORS)) if (v.re.test(text)) set.add(k);
    if (PACK[s.pack]) set.add(PACK[s.pack]);
  }
  return [...set];
}

// Questions for a firm, most-asked first. `stats`: [{ key, tenders }] learned from fetched tenders.
export function questionsFor(sectors = [], stats = []) {
  const freq = Object.fromEntries((stats || []).map((s) => [s.key, Number(s.tenders) || 0]));
  return CREDENTIALS.filter((c) => c.sectors.some((s) => sectors.includes(s)))
    .map((c, i) => ({ ...c, asked: freq[c.key] || 0, order: i }))
    .sort((a, b) => b.asked - a.asked || a.order - b.order);
}

// A tender's credentials against the Vault (facts `cred.<key>`): ok / bad / ask rows.
export function checkCredentials(found = [], facts = []) {
  const have = Object.fromEntries((facts || []).filter((f) => f.key?.startsWith("cred.")).map((f) => [f.key.slice(5), f.value]));
  return (found || []).filter((f) => CRED[f.key]).map((f) => {
    const c = CRED[f.key], v = have[f.key];
    const need = c.kind === "number" ? (f.need ? `at least ${f.need}` : "asked") : c.kind === "yesno" ? "Yes" : "asked";
    let state = "ask", shown = v ?? "—";
    if (v != null && v !== "") {
      if (c.kind === "yesno") { state = v === "yes" ? "ok" : "bad"; shown = v === "yes" ? "Yes" : "No"; }
      else if (c.kind === "number") state = f.need ? (Number(v) >= f.need ? "ok" : "bad") : Number(v) > 0 ? "ok" : "bad";
      else state = "ok";
    }
    return { key: f.key, label: c.label, need, have: String(shown), state, note: state === "ask" ? "Answer once in Vault → Credentials." : state === "bad" ? `Tender: “${f.text}”` : "" };
  });
}

// The industries' words as one POSIX regex for SQL credential_stats (\b → \y).
export const sectorRx = (keys = []) => keys.filter((k) => SECTORS[k]).map((k) => SECTORS[k].re.source.replace(/\\b/g, "\\y")).join("|") || null;
