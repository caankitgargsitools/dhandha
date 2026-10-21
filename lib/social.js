// Leads from social platforms, the permitted ways only: a user's own LinkedIn connections export, and
// Facebook / Instagram Lead Ads forms delivered by Meta. No scraping. Pure functions; tested in tests/social.test.mjs.

const clean = (v, max = 200) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max) || null;

// LinkedIn → Settings → Data privacy → Get a copy of your data → Connections.csv.
// A few note lines come first; the header is "First Name, Last Name, URL, Email Address, Company, Position, Connected On".
export function isLinkedInExport(rows) {
  return rows.slice(0, 6).some((r) => r.map((x) => String(x).trim().toLowerCase()).join("|").startsWith("first name|last name|url"));
}

export function leadsFromLinkedIn(rows) {
  const hi = rows.findIndex((r) => String(r[0]).trim().toLowerCase() === "first name" && String(r[2]).trim().toLowerCase() === "url");
  if (hi < 0) return { leads: [], skipped: 0, error: "This does not look like LinkedIn's Connections.csv." };
  const head = rows[hi].map((h) => String(h).trim().toLowerCase());
  const col = (n) => head.indexOf(n);
  const leads = [];
  let skipped = 0;
  for (const r of rows.slice(hi + 1)) {
    const person = clean(`${r[col("first name")] || ""} ${r[col("last name")] || ""}`, 120);
    const company = clean(r[col("company")]);
    const url = clean(r[col("url")], 300);
    if (!person || !/^https:\/\/([a-z]+\.)?linkedin\.com\/in\//i.test(url || "")) { skipped++; continue; }
    const position = clean(r[col("position")], 150);
    const email = String(r[col("email address")] || "").trim().toLowerCase();
    leads.push({
      name: company || person, contact_person: person, linkedin_url: url,
      email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null,
      notes: [position && `Position: ${position}`, r[col("connected on")] && `LinkedIn connection since ${clean(r[col("connected on")], 30)}`].filter(Boolean).join("\n") || null,
    });
  }
  return { leads, skipped };
}

// Meta Lead Ads field_data → lead. Standard field names from Meta's prefilled questions, plus common custom ones.
export function leadFromMetaFields(fieldData = []) {
  const f = {};
  for (const x of fieldData) f[String(x.name || "").toLowerCase()] = (x.values || []).join(", ");
  const pick = (...names) => { for (const n of names) if (f[n]) return clean(f[n]); return null; };
  const person = pick("full_name") || clean(`${f.first_name || ""} ${f.last_name || ""}`);
  const known = new Set(["full_name", "first_name", "last_name", "email", "work_email", "phone_number", "work_phone_number", "city", "state", "company_name", "job_title", "business_type", "industry"]);
  const extra = Object.entries(f).filter(([k, v]) => !known.has(k) && v).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`);
  return {
    name: pick("company_name") || person, contact_person: person,
    email: (pick("email", "work_email") || "").toLowerCase() || null, phone: pick("phone_number", "work_phone_number"),
    city: pick("city"), state: pick("state"), industry: pick("industry", "business_type"),
    notes: [pick("job_title") && `Job title: ${pick("job_title")}`, ...extra].filter(Boolean).join("\n").slice(0, 3000) || null,
  };
}
