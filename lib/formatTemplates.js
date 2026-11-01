// Standard tender formats (pure, tested). Many tenders list a format by number and heading only ("Annexure-7:
// Format for Power of Attorney") with no body. For such a heading Dhandha offers one or more ready versions —
// the person picks one and it arrives filled from the Vault, free; only what the Vault lacks becomes a yellow box.
// Template text uses {placeholders} (see `dataFor`) and table blocks the annexure editor and bid file understand.
import { TEMPLATES } from "./formatCatalog.js";
import { labelKey } from "./masters.js";

const BLANK = (label) => `[TO BE FILLED: ${label}]`;
const rs = (n) => (n === null || n === undefined || n === "" || !Number.isFinite(Number(n)) ? null : `Rs. ${Number(n).toLocaleString("en-IN")}`);
const date = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null);
const CONSTITUTION = { proprietorship: "Proprietorship firm", partnership: "Partnership firm", llp: "Limited Liability Partnership", private_limited: "Private Limited Company", public_limited: "Public Limited Company", opc: "One Person Company", trust: "Trust / Society" };
const cell = (v) => String(v ?? "").replace(/[|\n⟦⟧]/g, " ").trim();
const table = (cols, rows) => `\n⟦table ${cols.join("|")}⟧\n${rows.map((r) => r.map(cell).join("|")).join("\n")}\n⟦/table⟧\n`;
const fyKey = (p) => Number((String(p).match(/(\d{4})/) || [])[1] || 0);

// Everything a template can use, from the company record, facts, people, works, documents and the tender.
export function dataFor({ company = {}, facts = [], people = [], works = [], docs = [], docTypes = [], tender = {}, today = new Date() } = {}) {
  const c = company;
  const fact = (k) => facts.filter((f) => f.key === k).sort((a, b) => fyKey(b.period) - fyKey(a.period));
  const turnover = fact("fin.turnover").slice(0, 3);
  const netWorth = fact("fin.net_worth")[0];
  const owners = people.filter((p) => /partner|proprietor|director|owner|managing/i.test(p.designation || ""));
  const address = [c.registered_address, c.city, c.state, c.pincode].filter(Boolean).join(", ");
  const typeName = Object.fromEntries((docTypes || []).map((t) => [t.code, t.name]));
  const v = {
    legal_name: c.legal_name, trade_name: c.trade_name || c.legal_name, constitution: CONSTITUTION[c.constitution] || null,
    address: address || null, city: c.city, state: c.state, pincode: c.pincode, pan: c.pan, gstin: c.gstin, cin: c.cin,
    udyam_no: c.udyam_no, msme_category: c.msme_category ? c.msme_category[0].toUpperCase() + c.msme_category.slice(1) : null,
    incorporation_date: date(c.incorporation_date), years_in_business: c.incorporation_date ? String(Math.floor((today - new Date(c.incorporation_date)) / 31557600000)) : null,
    email: c.email, phone: c.phone, website: c.website,
    signatory_name: c.signatory_name, signatory_designation: c.signatory_designation, signatory_mobile: c.signatory_mobile,
    bank_name: c.bank_name, bank_account: c.bank_account, bank_ifsc: c.bank_ifsc,
    tender_title: tender.title, tender_ref: tender.tender_ref, authority: tender.authority || tender.department, department: tender.department || tender.authority,
    emd: rs(tender.emd_inr), today: date(today), place: c.city,
    net_worth: netWorth ? rs(netWorth.value) : null, net_worth_period: netWorth?.period || null,
    avg_turnover: turnover.length ? rs(Math.round(turnover.reduce((s, f) => s + Number(f.value || 0), 0) / turnover.length)) : null,
    owners: owners.length ? owners.map((p) => `${p.name}${p.designation ? ` (${p.designation})` : ""}`).join(", ") : null,
    bid_validity: Number(tender.bid_validity_days) > 0 ? `${Number(tender.bid_validity_days)} days` : "the period stated in the tender",
    frn: c.frn || null,
  };
  // answers given once in any earlier format ("master.*" facts) fill the same box in every later one
  const masters = Object.fromEntries(facts.filter((f) => String(f.key).startsWith("master.") && f.value !== null && f.value !== "").map((f) => [f.key, String(f.value)]));
  const tables = {
    turnover: turnover.length ? table(["Financial year", "Turnover (Rs.)"], turnover.map((f) => [f.period, Number(f.value).toLocaleString("en-IN")])) : null,
    works: works.length ? table(["Work", "Client", "Value (Rs.)", "Completed on"], works.filter((w) => w.status !== "ongoing").slice(0, 15).map((w) => [w.work_name, w.client, w.value_inr ? Number(w.value_inr).toLocaleString("en-IN") : "", w.end_date || ""])) : null,
    works_ongoing: works.some((w) => w.status === "ongoing") ? table(["Work", "Client", "Value (Rs.)", "Started on"], works.filter((w) => w.status === "ongoing").map((w) => [w.work_name, w.client, w.value_inr ? Number(w.value_inr).toLocaleString("en-IN") : "", w.start_date || ""])) : null,
    people: people.length ? table(["Name", "Designation", "Qualification", "Membership No.", "Years of experience"], people.slice(0, 20).map((p) => [p.name, p.designation || "", p.qualification || "", p.membership_no || "", p.years_experience != null ? String(p.years_experience) : ""])) : null,
    owners: owners.length ? table(["Name", "Designation", "PAN", "DIN / Membership No.", "Share %"], owners.map((p) => [p.name, p.designation || "", p.pan || "", p.din || p.membership_no || "", p.share_pct != null ? String(p.share_pct) : ""])) : null,
    documents: docs.length ? table(["Document", "Number", "Valid till"], docs.map((d) => [d.title || typeName[d.type_code] || d.type_code, d.number || "", d.valid_until || "—"])) : null,
  };
  return { v, tables, masters };
}

const LABELS = {
  legal_name: "name of the bidder", trade_name: "trade name", constitution: "constitution of the firm", address: "registered address", pan: "PAN", gstin: "GSTIN",
  cin: "CIN / registration no.", udyam_no: "Udyam registration no.", msme_category: "MSE category (micro / small)", incorporation_date: "date of incorporation",
  years_in_business: "years in business", email: "email", phone: "phone", signatory_name: "name of the authorised signatory", signatory_designation: "designation of the signatory",
  bank_name: "bank name", bank_account: "bank account no.", bank_ifsc: "IFSC", tender_ref: "tender reference no.", tender_title: "name of the work", authority: "name of the tendering authority",
  department: "department", emd: "EMD amount", place: "place", net_worth: "net worth", avg_turnover: "average annual turnover", owners: "names of partners / directors",
  signatory_father_name: "father's / husband's name of the signatory", signatory_age: "age of the signatory", signatory_address: "residential address of the signatory",
  frn: "FRN of the firm", peer_review: "peer review certificate no. and valid till", cag_empanelment: "C&AG empanelment no.", rbi_code: "RBI unique code and category",
  epf_code: "EPF establishment code", esic_code: "ESIC code",
};

// How a format is executed, for the picker ("on stamp paper", "your bank issues it").
export const EXEC_NOTE = { stamp: "on stamp paper, notarised", notary: "attested by a notary", ca: "signed by a CA with UDIN", bank: "your bank issues it — this is the text to hand over", oem: "the manufacturer signs it", client: "filled with the client" };
export const templateHint = (t) => [t.when, EXEC_NOTE[t.exec], t.official && "wording follows official formats"].filter(Boolean).join(" · ");

// The template's text for this company and tender: known values in place, the rest as yellow boxes.
export function renderTemplate(tpl, data) {
  const { v, tables, masters = {} } = data;
  const known = (k) => (v[k] !== null && v[k] !== undefined && v[k] !== "" ? String(v[k]) : null);
  const label = (k) => LABELS[k] || k.replace(/_/g, " ");
  return String(tpl.body)
    .replace(/\{table:(\w+)\}/g, (m, k) => tables[k] || BLANK(`complete the table of ${k.replace(/_/g, " ")}`))
    .replace(/\{(\w+)\}/g, (m, k) => known(k) ?? masters[labelKey(label(k))] ?? BLANK(label(k)))
    // a box the person already answered in another format ("[TO BE FILLED: FRN of the CA firm]") is filled too
    .replace(/\[TO BE FILLED: ([^\]]+)\]/g, (m, l) => masters[labelKey(l)] ?? m)
    .trim();
}

// Templates that fit a heading (and the first lines of its text), best first.
export function matchTemplates(title, text = "", { constitution } = {}) {
  const head = `${title} ${String(text).split("\n").slice(0, 3).join(" ")}`;
  const hits = TEMPLATES.filter((t) => t.re.test(head) && !(t.not && t.not.test(head)));
  // a version written for the firm's own constitution goes first (company board resolution vs partnership authority)
  const fit = (t) => (t.for ? (t.for.includes(constitution) ? 0 : 2) : 1);
  // a heading that says affidavit / stamp paper / notarised wants the sworn version first
  const sworn = /affidavit|stamp paper|notari[sz]ed|non[- ]judicial/i.test(head);
  const form = (t) => (sworn ? (t.stamp ? 0 : 1) : 0);
  return hits.sort((a, b) => form(a) - form(b) || fit(a) - fit(b) || (a.rank || 5) - (b.rank || 5));
}

export const templateById = (id) => TEMPLATES.find((t) => t.id === id) || null;

// A heading with little or no body text: the tender only names the format.
export const headingOnly = (text) => String(text || "").replace(/\s+/g, " ").trim().length < 160;
