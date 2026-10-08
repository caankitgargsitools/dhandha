// Lead helpers with no database or network: CSV import, phone clean-up, free fit score, outreach links.
// Pure functions so they run in server actions and in `node --test`.

export const SOURCES = { google_maps: "Google Maps", mca: "MCA new company", indiamart: "IndiaMART", website: "Website", directory: "Directory", tender_winner: "Tender winner", upload: "Your upload", referral: "Referral" };
export const LEAD_STATUS = { new: ["info", "New"], contacted: ["warn", "Contacted"], interested: ["ok", "Interested"], not_interested: ["mute", "Not interested"], converted: ["ok", "Converted"], junk: ["mute", "Junk"] };
export const STAGES = [["new", "New"], ["contacted", "Contacted"], ["qualified", "Qualified"], ["meeting", "Meeting"], ["proposal", "Proposal sent"], ["negotiation", "Negotiation"], ["won", "Won"], ["lost", "Lost"]];
export const ACTIVITY = { call: "Call", whatsapp: "WhatsApp", email: "Email", sms: "SMS", meeting: "Meeting", visit: "Site visit", note: "Note", stage: "Stage change" };
// Tender industry packs, as the kind of business a tender winner runs.
export const PACKS = { construction: "Construction / civil contractor", it_services: "IT, manpower & services", ca_audit: "Audit & accounts", goods_supply: "Supply of goods" };
export const OUTCOMES = { connected: "Connected", no_answer: "No answer", busy: "Busy / call back", wrong_number: "Wrong number", interested: "Interested", not_interested: "Not interested", sent: "Sent" };

// RFC 4180-ish CSV: quoted fields, doubled quotes, commas/newlines inside quotes, CRLF.
export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", q = false;
  const s = String(text || "").replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

// Column names people actually use in their Excel sheets.
const HEADERS = {
  name: ["name", "business", "business name", "company", "company name", "firm", "firm name", "organisation", "organization", "party", "party name", "client"],
  contact_person: ["contact", "contact person", "contact name", "person", "owner", "proprietor", "director", "full name"],
  phone: ["phone", "mobile", "mobile no", "mobile number", "phone no", "phone number", "contact no", "contact number", "whatsapp", "cell", "tel"],
  email: ["email", "e-mail", "email id", "mail", "email address"],
  city: ["city", "town", "district", "location"],
  state: ["state"],
  industry: ["industry", "sector", "category", "business type", "line of business", "nature of business"],
  website: ["website", "web", "url", "site"],
  gstin: ["gstin", "gst", "gst no", "gst number"],
  notes: ["notes", "remarks", "comment", "comments"],
};

export function mapHeaders(header) {
  const norm = (h) => String(h || "").toLowerCase().replace(/[_.]/g, " ").replace(/\s+/g, " ").trim();
  const map = {};
  header.forEach((h, i) => {
    const n = norm(h);
    for (const [key, names] of Object.entries(HEADERS)) if (!(key in map) && names.includes(n)) { map[key] = i; break; }
  });
  return map;
}

// Indian mobile/landline to its last 10 digits; '' when it is not a usable number.
export function normPhone(p) {
  const d = String(p || "").replace(/\D/g, "");
  if (d.length < 10) return "";
  return d.slice(-10);
}

export const normEmail = (e) => {
  const v = String(e || "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? v : "";
};

const clean = (v, max = 200) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max) || null;

// CSV text → lead rows, plus a count of lines skipped for having no name and no way to reach them.
export function leadsFromCsv(text, { maxRows = 2000 } = {}) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { leads: [], skipped: 0, error: "The file needs a header row and at least one lead." };
  const map = mapHeaders(rows[0]);
  if (!("name" in map) && !("contact_person" in map)) return { leads: [], skipped: 0, error: "Could not find a Name or Company column in the first row." };
  const body = rows.slice(1, maxRows + 1);
  const leads = [];
  let skipped = 0;
  for (const r of body) {
    const get = (k, max) => (k in map ? clean(r[map[k]], max) : null);
    const lead = {
      name: get("name") || get("contact_person"),
      contact_person: get("contact_person", 120),
      phone: get("phone", 40),
      email: normEmail(get("email")) || null,
      city: get("city", 80),
      state: get("state", 80),
      industry: get("industry", 120),
      website: get("website"),
      gstin: get("gstin", 15)?.toUpperCase() || null,
      notes: get("notes", 1000),
    };
    if (!lead.name || (!normPhone(lead.phone) && !lead.email)) { skipped++; continue; }
    leads.push(lead);
  }
  return { leads, skipped, truncated: rows.length - 1 > maxRows };
}

const words = (s) => String(s || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
const overlaps = (a, list) => {
  const w = new Set(words(a));
  return (list || []).some((item) => words(item).some((x) => w.has(x) || w.has(x.replace(/s$/, "")) || w.has(x + "s")));
};
const same = (a, list) => (list || []).some((x) => String(x).trim().toLowerCase() === String(a || "").trim().toLowerCase());

// Free fit score out of 100 against the company's ideal client. Returns the reasons too, so the score is explainable.
export function scoreLead(lead, ideal = {}) {
  const reasons = [];
  let s = 0;
  const add = (n, why) => { s += n; reasons.push(why); };
  if (normPhone(lead.phone)) add(20, "Has a phone number");
  if (normEmail(lead.email)) add(10, "Has an email");
  if (lead.contact_person) add(10, "Named contact person");
  if ((ideal.industries || []).length && overlaps(lead.industry, ideal.industries)) add(25, "Industry you target");
  if ((ideal.cities || []).length && same(lead.city, ideal.cities)) add(20, "City you serve");
  else if ((ideal.states || []).length && same(lead.state, ideal.states)) add(12, "State you serve");
  const src = { referral: [15, "Referral"], tender_winner: [12, "Recently won a tender"], mca: [10, "Newly registered company"], website: [8, "Came through your website"] }[lead.source];
  if (src) add(src[0], src[1]);
  if (lead.website) add(5, "Has a website");
  if (lead.dnd) { s = Math.min(s, 20); reasons.push("Do-not-disturb: no cold calls"); }
  return { score: Math.max(0, Math.min(100, s)), reasons };
}

// Click-to-chat link; the person sends from their own WhatsApp, so nothing is sent on their behalf.
export function waLink(phone, text = "") {
  const p = normPhone(phone);
  if (!p) return null;
  return `https://wa.me/91${p}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export const telLink = (phone) => (normPhone(phone) ? `tel:+91${normPhone(phone)}` : null);

export function fillTemplate(tpl, lead, company) {
  return String(tpl || "")
    .replace(/\{name\}/g, lead.contact_person?.split(" ")[0] || "Sir/Madam")
    .replace(/\{business\}/g, lead.name || "")
    .replace(/\{city\}/g, lead.city || "")
    .replace(/\{our_company\}/g, company?.legal_name || "");
}

export const DEFAULT_TEMPLATE = "Namaste {name}, this is from {our_company}. We work with businesses like {business} in {city}. Could we take 10 minutes this week to show how we can help?";

// Comma or newline separated list from a form field.
export const listField = (v) => [...new Set(String(v || "").split(/[,\n]/).map((x) => x.trim()).filter(Boolean))].slice(0, 50);
