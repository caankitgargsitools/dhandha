// The tender-ready checklist (owner, 1–2 Nov: "an intelligent master page — from the services a firm selected and the
// kind of buyers it sells to, what questions, information, certificates and registrations its tenders need; ask them one
// at a time and ask for the documents, so the masters are complete before any tender"). Pure and tested: masterPlan()
// lists what this firm needs, masterStatus() marks each item from the Vault, nextItem() is the one to ask now.
import { questionsFor } from "./credentials.js";

export const BUYERS = [
  { key: "central", label: "Central ministries & departments" },
  { key: "state", label: "State government departments" },
  { key: "psu", label: "PSUs (NTPC, IOCL, BHEL, Coal India…)" },
  { key: "railways", label: "Railways" },
  { key: "banks", label: "Banks & insurance companies" },
  { key: "gem", label: "GeM (Government e-Marketplace)" },
  { key: "defence", label: "Defence" },
  { key: "local", label: "Municipal & local bodies" },
];

const COMPANY = [
  ["legal_name", "Legal name of the firm"], ["constitution", "Constitution (proprietorship, partnership, LLP, company…)"], ["pan", "PAN of the firm"],
  ["gstin", "GSTIN"], ["registered_address", "Registered address"], ["incorporation_date", "Date of incorporation / registration"],
  ["signatory_name", "Authorised signatory's name"], ["signatory_designation", "Authorised signatory's designation"],
  ["bank_account", "Bank account number (EMD refunds)"], ["bank_ifsc", "Bank IFSC"],
];
const DOCS = {
  base: [["REG-PAN", "PAN card"], ["REG-GST", "GST registration certificate"], ["REG-INC", "Incorporation certificate / partnership deed"], ["FIN-AUDIT", "Audited balance sheets (last 3 years)"],
    ["FIN-ITR", "ITR acknowledgements (last 3 years)"], ["FIN-CA-CERT", "CA certificate of turnover / net worth"], ["LEG-POA", "Power of attorney / board resolution for the signatory"], ["DSC", "Class 3 DSC details"]],
  works: [["CERT-CONTR", "Contractor registration"], ["FIN-SOLV", "Bank solvency certificate"], ["CERT-EPF", "EPF registration"], ["CERT-ESI", "ESI registration"], ["CERT-LAB", "Labour licence"], ["EXP-CC", "Completion certificates of past works"]],
  electrical: [["CERT-CONTR", "Electrical contractor licence / registration"], ["EXP-CC", "Completion certificates of past works"]],
  manpower: [["CERT-EPF", "EPF registration"], ["CERT-ESI", "ESI registration"], ["CERT-LAB", "Labour licence"], ["EXP-WO", "Work orders of past contracts"]],
  it: [["CERT-ISO", "ISO certificate"], ["EXP-WO", "Work / purchase orders of past projects"]],
  audit: [["CERT-ICAI", "ICAI firm registration (FRN)"], ["CERT-PEER", "ICAI peer review certificate"], ["EXP-WO", "Appointment letters of past audits"], ["PEOPLE-CV", "CVs of partners and key staff"]],
  consultancy: [["EXP-WO", "Work orders of past assignments"], ["PEOPLE-CV", "CVs of key experts"]],
  supply: [["EXP-WO", "Purchase orders of past supplies"]],
  medical: [["EXP-WO", "Purchase orders of past supplies"]],
  transport: [["EXP-WO", "Work orders of past contracts"]],
  catering: [["CERT-LAB", "Labour licence"], ["EXP-WO", "Work orders of past contracts"]],
};
// registrations each kind of buyer asks for (yes / no or a number, kept as facts)
const BUYER_ITEMS = {
  gem: [{ key: "reg.gem_seller", label: "Registered as a seller on GeM (vendor assessment done if you sell products)?", type: "yesno" },
    { key: "reg.gem_profile_turnover", label: "Turnover updated in your GeM seller profile this year? (GeM checks it there)", type: "yesno", yearly: true }],
  railways: [{ key: "reg.ireps", label: "Registered on IREPS (Railways e-procurement)?", type: "yesno" }],
  psu: [{ key: "reg.psu_vendor", label: "Enlisted as a vendor with any PSU or its engineering consultant (EIL, Technip…)? Which?", type: "text" }],
  defence: [{ key: "reg.defence", label: "Registered with Defence (DPP / MoD vendor registration)?", type: "yesno" }],
  central: [{ key: "reg.cppp", label: "Registered on CPPP (eprocure.gov.in) with your DSC?", type: "yesno" }],
  state: [{ key: "reg.state_portals", label: "State e-procurement portals you are registered on (e.g. UP, MP, Haryana)?", type: "text" }],
  local: [{ key: "reg.local_body", label: "Enlisted with any municipal corporation / development authority? Which?", type: "text" }],
  banks: [{ key: "reg.bank_vendor", label: "Empanelled with any bank or insurer as a vendor? Which?", type: "text" }],
};

// documents each kind of buyer asks for with the bid (Q17: banks and Defence create a vendor code from them)
const BUYER_DOCS = { banks: [["BANK-CHEQUE", "Cancelled cheque"], ["BANK-EFT", "EFT / NEFT mandate certified by your bank"]], defence: [["BANK-CHEQUE", "Cancelled cheque"], ["BANK-EFT", "EFT / NEFT mandate certified by your bank"]], psu: [["BANK-EFT", "EFT / NEFT mandate certified by your bank"]] };

// sectors: SECTORS keys (lib/credentials.js firmSectors); buyers: BUYERS keys; stats: credential_stats rows
export function masterPlan({ sectors = [], buyers = [], stats = [], msme = false } = {}) {
  const items = [];
  const add = (it) => { if (!items.some((x) => x.id === it.id)) items.push(it); };
  add({ id: "buyers", group: "About you", kind: "buyers", label: "Which kinds of buyers do you sell to?", why: "Decides which registrations your tenders ask for" });
  for (const [field, label] of COMPANY) add({ id: `c:${field}`, group: "Company details", kind: "company", field, label, why: "Printed on every format and covering letter" });
  if (msme) add({ id: "c:udyam_no", group: "Company details", kind: "company", field: "udyam_no", label: "Udyam registration number", why: "EMD exemption and MSE purchase preference" });
  add({ id: "f:turnover", group: "Money", kind: "turnover", label: "Turnover of the last 3 financial years", why: "Average / aggregate turnover tests in almost every tender" });
  add({ id: "f:net_worth", group: "Money", kind: "fact", key: "fin.net_worth", label: "Net worth (latest year)", why: "Net-worth and financial-standing tests" });
  add({ id: "p:people", group: "Team & experience", kind: "people", label: "Key people (partners, directors, engineers / experts)", why: "Key-personnel tables and points" });
  add({ id: "w:works", group: "Team & experience", kind: "works", label: "Completed works / assignments with value and client", why: "Similar-work criteria and experience tables" });
  for (const [code, label] of DOCS.base) add({ id: `d:${code}`, group: "Documents", kind: "doc", code, label, why: "Asked by nearly every tender" });
  for (const s of sectors) for (const [code, label] of DOCS[s] || []) add({ id: `d:${code}`, group: "Documents", kind: "doc", code, label, why: "Asked in tenders for your kind of work" });
  if (msme) add({ id: "d:REG-UDYAM", group: "Documents", kind: "doc", code: "REG-UDYAM", label: "Udyam / MSME certificate", why: "EMD exemption, MSE preference" });
  for (const q of questionsFor(sectors, stats)) add({ id: `q:${q.key}`, group: "Licences, registrations & team", kind: "cred", key: q.key, label: q.ask, type: q.kind, why: q.asked ? `Asked in ${q.asked} fetched tender${q.asked === 1 ? "" : "s"} for your work` : "Often asked for your kind of work" });
  if (sectors.includes("supply") || buyers.includes("gem")) add({ id: "b:brands", group: "Licences, registrations & team", kind: "brands", label: "Brands you sell and what you supplied each year", why: "OEM authorisation and GeM past-performance" });
  for (const b of buyers) for (const [code, label] of BUYER_DOCS[b] || []) add({ id: `d:${code}`, group: "Documents", kind: "doc", code, label, why: "For the buyer's vendor code and payments" });
  for (const b of buyers) for (const it of BUYER_ITEMS[b] || []) add({ id: `r:${it.key}`, group: "Registrations with buyers", kind: "fact", key: it.key, label: it.label, type: it.type, yearly: !!it.yearly, why: BUYERS.find((x) => x.key === b)?.label || "" });
  return items;
}

// "FY 2026-27" for the financial year a date falls in (April–March), the same style as lastFys() in lib/masters.js
export function currentFy(now = new Date()) {
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `FY ${y}-${String(y + 1).slice(2)}`;
}

const has = (v) => v !== null && v !== undefined && String(v).trim() !== "";
// v: { company, docs: [{type_code, valid_until}], facts: [{key, period, value}], people: n, works: n, buyers: [] , brands: n }
export function masterStatus(items, v = {}) {
  const facts = v.facts || [], docs = v.docs || [], today = new Date().toISOString().slice(0, 10);
  const fact = (k) => facts.find((f) => f.key === k && has(f.value));
  return items.map((it) => {
    let done = false, note = null;
    if (it.kind === "buyers") done = (v.buyers || []).length > 0;
    else if (it.kind === "company") done = has(v.company?.[it.field]);
    else if (it.kind === "turnover") { const n = facts.filter((f) => f.key === "fin.turnover" && has(f.value)).length; done = n >= 3; note = n && n < 3 ? `${n} of 3 years` : null; }
    else if (it.kind === "fact" && it.yearly) {
      // Q15: asked again every financial year (GeM reads the turnover from the seller profile, not the bid)
      const fy = currentFy(v.now || new Date()), f = facts.find((x) => x.key === it.key && x.period === fy);
      done = f?.value === "yes";
      if (!done) note = facts.some((x) => x.key === it.key && x.period !== fy) ? `update for ${fy}` : f?.value === "no" ? "not yet" : null;
    }
    else if (it.kind === "fact") done = !!fact(it.key);
    else if (it.kind === "cred") done = !!fact(`cred.${it.key}`);
    else if (it.kind === "people") done = (v.people || 0) > 0;
    else if (it.kind === "works") done = (v.works || 0) > 0;
    else if (it.kind === "brands") done = (v.brands || 0) > 0;
    else if (it.kind === "doc") {
      const d = docs.filter((x) => x.type_code === it.code).sort((a, b) => String(b.valid_until || "9999").localeCompare(String(a.valid_until || "9999")))[0];
      done = !!d && (!d.valid_until || d.valid_until >= today);
      if (d && !done) note = `expired ${d.valid_until}`;
    }
    return { ...it, done, note };
  });
}

// the next thing to ask: who you sell to first, then what nearly every tender needs, then the rest in list order
export const nextItem = (status) => status.find((s) => !s.done) || null;
export const progress = (status) => ({ done: status.filter((s) => s.done).length, total: status.length });
