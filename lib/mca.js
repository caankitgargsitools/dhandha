// Newly registered companies and LLPs from MCA's public data files (the monthly "companies registered"
// lists and the data.gov.in company master format). Pure functions; tested in tests/mca.test.mjs.
import { excelDate } from "./xlsx.js";

const HEADERS = {
  cin: ["cin", "corporate identification number", "corporate_identification_number", "llpin", "llp identification number", "fcrn"],
  name: ["company name", "company_name", "name of company", "name of the company", "llp name", "name of llp", "name"],
  incorporated_on: ["date of incorporation", "date_of_registration", "date of registration", "incorporation date", "date of incorporation/registration"],
  state: ["state", "registered_state", "registered state", "state name"],
  roc: ["roc", "registrar_of_companies", "registrar of companies", "roc code"],
  category: ["category", "company_category", "company category"],
  class: ["class", "company_class", "company class"],
  authorized_capital: ["authorized capital", "authorised capital", "authorized_cap", "authorized capital (rs.)", "authorised capital (rs.)", "authorized capital (rs)"],
  paid_up_capital: ["paid up capital", "paidup_capital", "paid-up capital", "paid up capital (rs.)", "paid up capital (rs)", "total obligation of contribution"],
  activity_code: ["activity code", "industrial_class", "nic code", "main division of business activity"],
  activity: ["activity description", "principal_business_activity_as_per_cin", "principal business activity", "business activity", "description of main division"],
  address: ["registered office address", "registered_office_address", "address", "registered address"],
  email: ["email", "email id", "email_addr", "email address", "e-mail"],
};

const STATE_CODES = { AP: "Andhra Pradesh", AR: "Arunachal Pradesh", AS: "Assam", BR: "Bihar", CH: "Chandigarh", CT: "Chhattisgarh", DL: "Delhi", GA: "Goa", GJ: "Gujarat", HP: "Himachal Pradesh", HR: "Haryana", JH: "Jharkhand", JK: "Jammu and Kashmir", KA: "Karnataka", KL: "Kerala", LA: "Ladakh", MH: "Maharashtra", ML: "Meghalaya", MN: "Manipur", MP: "Madhya Pradesh", MZ: "Mizoram", NL: "Nagaland", OR: "Odisha", PB: "Punjab", PY: "Puducherry", RJ: "Rajasthan", SK: "Sikkim", TG: "Telangana", TN: "Tamil Nadu", TR: "Tripura", TS: "Telangana", UK: "Uttarakhand", UP: "Uttar Pradesh", UR: "Uttarakhand", WB: "West Bengal" };

// NIC 2008 divisions (first two digits of the activity code) grouped into sections.
const NIC = [[3, "Agriculture, forestry & fishing"], [9, "Mining & quarrying"], [33, "Manufacturing"], [35, "Electricity & gas"], [39, "Water supply & waste management"], [43, "Construction"], [47, "Wholesale & retail trade"], [53, "Transport & logistics"], [56, "Hotels & restaurants"], [63, "Information technology & media"], [66, "Financial services"], [68, "Real estate"], [75, "Professional, scientific & technical services"], [82, "Administrative & support services"], [84, "Public administration"], [85, "Education"], [88, "Health & social work"], [93, "Arts, entertainment & recreation"], [99, "Other services"]];
export const nicSection = (code) => {
  const d = Number(String(code || "").replace(/\D/g, "").slice(0, 2));
  return d ? NIC.find(([max]) => d <= max)?.[1] || null : null;
};

const CIN_RX = /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/;
const LLPIN_RX = /^[A-Z]{3}-\d{4}$/;

// What the CIN itself says: listed or not, activity code, state, year, type (PTC, PLC, OPC…).
export function parseCin(cin) {
  const c = String(cin || "").trim().toUpperCase();
  if (CIN_RX.test(c)) return { cin: c, listed: c[0] === "L", activity_code: c.slice(1, 6), state: STATE_CODES[c.slice(6, 8)] || null, year: Number(c.slice(8, 12)), type: c.slice(12, 15) };
  if (LLPIN_RX.test(c)) return { cin: c, type: "LLP" };
  return null;
}

export function parseDay(v) {
  const s = String(v || "").trim();
  if (!s) return null;
  if (/^\d{4,5}(\.\d+)?$/.test(s)) return excelDate(s);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[-/.](\d{1,2}|[A-Za-z]{3})[-/.](\d{2,4})$/);
  if (!m) return null;
  const mon = /\d/.test(m[2]) ? Number(m[2]) : ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m[2].toLowerCase()) + 1;
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  if (!mon || mon > 12 || Number(m[1]) > 31) return null;
  return `${y}-${String(mon).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
}

const money = (v) => { const n = Number(String(v ?? "").replace(/[₹,\s]|rs\.?|inr/gi, "")); return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : null; };
const clean = (v, max = 300) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max) || null;

export const pincodeFrom = (addr) => (String(addr || "").match(/\b([1-9]\d{5})\b/) || [])[1] || null;

// Rows (first row = header) → company records. Rows without a valid CIN/LLPIN or name are skipped.
export function mcaFromRows(rows) {
  if (!rows?.length) return { companies: [], skipped: 0, error: "The file is empty." };
  const hi = rows.slice(0, 10).findIndex((r) => r.some((x) => HEADERS.cin.includes(String(x).trim().toLowerCase().replace(/\s+/g, " "))));
  if (hi < 0) return { companies: [], skipped: 0, error: "Could not find a CIN or LLPIN column in the first rows." };
  const head = rows[hi].map((h) => String(h).trim().toLowerCase().replace(/\s+/g, " "));
  const col = Object.fromEntries(Object.entries(HEADERS).map(([k, names]) => [k, head.findIndex((h) => names.includes(h))]));
  const companies = [];
  let skipped = 0;
  for (const r of rows.slice(hi + 1)) {
    const get = (k) => (col[k] >= 0 ? r[col[k]] : "");
    const cinInfo = parseCin(get("cin"));
    const name = clean(get("name"), 300);
    if (!cinInfo || !name) { skipped++; continue; }
    const address = clean(get("address"), 600);
    const code = clean(get("activity_code"), 10) || cinInfo.activity_code || null;
    const email = String(get("email") || "").trim().toLowerCase();
    companies.push({
      cin: cinInfo.cin, name, kind: cinInfo.type === "LLP" ? "llp" : "company",
      incorporated_on: parseDay(get("incorporated_on")),
      state: clean(get("state"), 80) || cinInfo.state || null,
      roc: clean(get("roc"), 80), category: clean(get("category"), 120), class: clean(get("class"), 60) || ({ PTC: "Private", PLC: "Public", OPC: "One Person Company" }[cinInfo.type] || null),
      authorized_capital: money(get("authorized_capital")), paid_up_capital: money(get("paid_up_capital")),
      activity_code: code, activity: clean(get("activity"), 300) || nicSection(code),
      address, pincode: pincodeFrom(address),
      email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null,
    });
  }
  return { companies, skipped };
}
