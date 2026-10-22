// Data marketplace uploads: a spreadsheet's header row → known fields (name, company, role, industry, city,
// state, email, phone, LinkedIn, website) plus every other column kept as an extra; columns with a small set of
// values become filters. Pure functions: run in server actions and in `node --test`.

const CORE = {
  name: ["name", "full name", "contact", "contact name", "contact person", "person", "first name"],
  company: ["company", "company name", "organisation", "organization", "firm", "business", "business name", "employer", "account"],
  role: ["role", "designation", "title", "job title", "position", "job role", "seniority"],
  industry: ["industry", "sector", "category", "vertical", "line of business"],
  city: ["city", "town", "location", "district"],
  state: ["state", "region", "province"],
  email: ["email", "e-mail", "email id", "email address", "mail"],
  phone: ["phone", "mobile", "mobile number", "phone number", "contact number", "contact no", "mobile no", "whatsapp", "cell"],
  linkedin_url: ["linkedin", "linkedin url", "linkedin profile", "profile url", "person linkedin url"],
  website: ["website", "web", "url", "domain", "company website"],
};
const norm = (h) => String(h || "").toLowerCase().replace(/[_.]/g, " ").replace(/\s+/g, " ").trim();
const slug = (h) => norm(h).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "col";

// header → { core: {field: index}, extras: [{key, label, index}] }
export function mapColumns(header) {
  const core = {}, extras = [], used = new Set();
  header.forEach((h, i) => {
    const n = norm(h);
    for (const [k, names] of Object.entries(CORE)) if (!(k in core) && names.includes(n)) { core[k] = i; used.add(i); return; }
  });
  // "First name" + "Last name" → name
  const last = header.findIndex((h) => ["last name", "surname"].includes(norm(h)));
  header.forEach((h, i) => {
    if (used.has(i) || i === last || !norm(h)) return;
    let key = slug(h);
    while (extras.some((e) => e.key === key) || key in CORE) key += "_2";
    extras.push({ key, label: String(h).trim().slice(0, 60), index: i });
  });
  return { core, extras, last };
}

const clean = (v, max = 200) => { const s = String(v ?? "").replace(/\s+/g, " ").trim(); return s ? s.slice(0, max) : null; };

// rows (first = header) → records ready for data_ingest
export function rowsToRecords(rows, { maxRows = 200000 } = {}) {
  if (!rows?.length || rows.length < 2) return { error: "The file needs a header row and at least one record." };
  const { core, extras, last } = mapColumns(rows[0]);
  if (!("name" in core) && !("company" in core)) return { error: "Could not find a Name or Company column in the first row." };
  const records = [];
  for (const r of rows.slice(1, maxRows + 1)) {
    const g = (k, max) => (k in core ? clean(r[core[k]], max) : null);
    const name = [g("name", 120), last >= 0 ? clean(r[last], 80) : null].filter(Boolean).join(" ") || null;
    const rec = { name, company: g("company"), role: g("role", 160), industry: g("industry", 160), city: g("city", 80), state: g("state", 80),
      email: g("email")?.toLowerCase() || null, phone: g("phone", 40), linkedin_url: g("linkedin_url", 300), website: g("website", 300), extra: {} };
    for (const e of extras) { const v = clean(r[e.index], 200); if (v) rec.extra[e.key] = v; }
    if (rec.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rec.email)) rec.email = null;
    if (rec.name || rec.company) records.push(rec);
  }
  const fields = [
    ...["company", "role", "industry", "city", "state"].filter((k) => k in core).map((k) => ({ key: k, label: k[0].toUpperCase() + k.slice(1) })),
    ...extras.map((e) => ({ key: e.key, label: e.label })),
  ];
  return { records, fields, truncated: rows.length - 1 > maxRows, mapped: Object.keys(core) };
}

// Columns with a small set of repeated values become filters, with the most common values.
export function buildFacets(records, fields, { maxValues = 200, minCoverage = 0.2 } = {}) {
  const facets = {};
  for (const f of fields) {
    const counts = new Map();
    let filled = 0;
    for (const r of records) {
      const v = ["company", "role", "industry", "city", "state"].includes(f.key) ? r[f.key] : r.extra[f.key];
      if (!v) continue;
      filled++;
      counts.set(v, (counts.get(v) || 0) + 1);
      if (counts.size > maxValues) break;
    }
    if (counts.size < 2 || counts.size > maxValues || filled < records.length * minCoverage) continue;
    facets[f.key] = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60);
  }
  return { facets, fields: fields.map((f) => ({ ...f, facet: !!facets[f.key] })) };
}
