// AI tender check (tested in tests/tenderCheck.test.mjs): after the free rules pick candidate tenders, an AI reads
// what each one is actually for and says whether the firm can bid for it. Only public tender text and the firm's
// service names go out (no company name, no Vault), so the free Gemini tier may be used first.
import { SERVICE_INDEX, parseRule } from "./taxonomy.js";

export const FITS = ["yes", "no", "maybe"];

export function firmProfile(serviceIds = [], custom = [], index = SERVICE_INDEX) {
  const lines = serviceIds.map((id) => index[id]).filter(Boolean)
    .map((s) => `- ${s.label}: ${[...new Set(s.kw.map((w) => parseRule(w).k))].slice(0, 8).join(", ")}`);
  if (custom.length) lines.push(`- Also: ${custom.map((c) => parseRule(c).k).join(", ")}`);
  return lines.join("\n");
}

// items: [{ id, title, authority, department, category, summary, value }] → prompt with short keys t1, t2 …
export function buildPrompt(profile, items) {
  const list = items.map((t, i) => {
    const bits = [`t${i + 1}: ${String(t.title || "").replace(/\s+/g, " ").trim()}`];
    if (t.authority || t.department) bits.push(`   buyer: ${[t.authority, t.department].filter(Boolean).join(" / ")}`);
    if (t.category) bits.push(`   category: ${t.category}`);
    if (t.summary) bits.push(`   details: ${String(t.summary).replace(/\s+/g, " ").slice(0, 500)}`);
    return bits.join("\n");
  }).join("\n");
  return `You screen Indian government tenders for a professional firm. The firm offers ONLY these services:
${profile}

For each tender below, decide whether the main work asked for is one of these services, so the firm could bid for it itself:
- "yes": the work is clearly one of the firm's services.
- "no": the work is something else — civil/electrical works, supply of goods, engineering design or supervision, IT/software development, architecture, manpower unrelated to the services, events, etc. — even if a word like "audit", "accounts", "consultant" or "compliance" appears.
- "maybe": the title is too vague to tell.
Give a reason of at most 12 words.

Tenders:
${list}

Answer as JSON: {"results":[{"key":"t1","fit":"yes","reason":"…"}]} with one entry per tender, same keys.`;
}

const list = (data) => (Array.isArray(data) ? data : data?.results);

export function validateAnswer(data, n) {
  const r = list(data);
  if (!Array.isArray(r)) return "no results array";
  if (r.length < Math.ceil(n * 0.8)) return `only ${r.length} of ${n} answered`;
  if (r.some((x) => !FITS.includes(String(x?.fit || "").toLowerCase()))) return "unknown fit value";
  return null;
}

// AI answer → [{ id, fit, reason }] for the database (unknown keys dropped).
export function mapAnswer(data, items) {
  const out = [];
  for (const x of list(data) || []) {
    const i = Number(String(x.key || "").replace(/^t/i, "")) - 1;
    const fit = String(x.fit || "").toLowerCase();
    if (items[i] && FITS.includes(fit)) out.push({ id: items[i].id, fit, reason: String(x.reason || "").slice(0, 200) });
  }
  return out;
}
